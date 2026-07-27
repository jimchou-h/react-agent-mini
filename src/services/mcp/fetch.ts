import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { createUserMessage } from '../../utils/messages.js'
import type { UserMessage } from '../../types/message.js'
import { normalizeNameForMCP } from './adapter.js'
import type {
  McpConnectedClient,
  McpResourceEntry,
  McpSlashCommand,
} from './types.js'

export const MCP_RESOURCE_INJECT_MAX_CHARS = 100_000

/** list resources；无 capability 或失败 → [] */
export async function fetchResourcesForClient(
  client: McpConnectedClient,
  options?: { warn?: (msg: string) => void },
): Promise<McpResourceEntry[]> {
  if (!client.capabilities?.resources) {
    return []
  }

  try {
    const result = await client.client.listResources()
    return (result.resources ?? []).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      mimeType: resource.mimeType,
      description: resource.description,
      server: client.serverId,
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    options?.warn?.(
      `警告: MCP server "${client.serverId}" resources/list 失败 — ${msg}`,
    )
    return []
  }
}

/** list prompts → slash 命令；无 capability 或失败 → [] */
export async function fetchCommandsForClient(
  client: McpConnectedClient,
  options?: { warn?: (msg: string) => void },
): Promise<McpSlashCommand[]> {
  if (!client.capabilities?.prompts) {
    return []
  }

  try {
    const result = await client.client.listPrompts()
    const prompts = result.prompts ?? []

    return prompts.map(prompt => {
      const argNames = (prompt.arguments ?? []).map(arg => arg.name)
      const internalName =
        'mcp__' +
        normalizeNameForMCP(client.serverId) +
        '__' +
        prompt.name
      const slashLabel = `${client.serverId}:${prompt.name} (MCP)`

      return {
        serverId: client.serverId,
        promptName: prompt.name,
        internalName,
        description: prompt.description ?? '',
        argNames,
        slashLabel,
        async run(argsLine: string) {
          const argsArray = argsLine.trim() ? argsLine.trim().split(/\s+/) : []
          const args: Record<string, string> = {}
          for (let i = 0; i < argNames.length; i++) {
            const key = argNames[i]
            if (key) {
              args[key] = argsArray[i] ?? ''
            }
          }
          const result = await client.client.getPrompt({
            name: prompt.name,
            arguments: args,
          })
          return promptMessagesToUserMessages(result.messages ?? [])
        },
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    options?.warn?.(
      `警告: MCP server "${client.serverId}" prompts/list 失败 — ${msg}`,
    )
    return []
  }
}

/** read resource；失败抛错 */
export async function readMcpResource(
  client: McpConnectedClient,
  uri: string,
): Promise<{ uri: string; mimeType?: string; text?: string; blobSavedTo?: string }[]> {
  if (!client.capabilities?.resources) {
    throw new Error(`Server "${client.serverId}" does not support resources`)
  }

  const result = await client.client.readResource({ uri })
  return (result.contents ?? []).map(item => {
    if ('text' in item && typeof item.text === 'string') {
      return {
        uri: item.uri,
        mimeType: item.mimeType,
        text: item.text,
      }
    }
    if ('blob' in item && typeof item.blob === 'string') {
      return {
        uri: item.uri,
        mimeType: item.mimeType,
        blobSavedTo: `[binary blob omitted: ${item.mimeType ?? 'application/octet-stream'}]`,
      }
    }
    return { uri: item.uri, mimeType: item.mimeType, text: JSON.stringify(item) }
  })
}

/**
 * Host 侧挂载：读取指定 server 的 resources，转为 meta 消息。
 * 对齐 tour how-to-host：slash prompt 前先把材料塞进本轮上下文。
 */
export async function loadServerResourcesAsMetaMessages(
  clients: readonly McpConnectedClient[],
  serverId: string,
  options?: { warn?: (msg: string) => void; maxChars?: number },
): Promise<UserMessage[]> {
  const client = clients.find(item => item.serverId === serverId)
  if (!client?.capabilities?.resources) {
    return []
  }

  const maxChars = options?.maxChars ?? MCP_RESOURCE_INJECT_MAX_CHARS
  const listed = await fetchResourcesForClient(client, options)
  const messages: UserMessage[] = []

  for (const resource of listed) {
    try {
      const contents = await readMcpResource(client, resource.uri)
      const body = contents
        .map(item => {
          if (item.text) {
            return item.text.length > maxChars
              ? `${item.text.slice(0, maxChars)}\n\n[truncated]`
              : item.text
          }
          return item.blobSavedTo ?? ''
        })
        .filter(Boolean)
        .join('\n\n')

      if (!body) continue

      const text = [
        '以下材料来自 MCP Resource，请严格遵守：',
        `server=${serverId} uri=${resource.uri} name=${resource.name}`,
        '',
        body,
      ].join('\n')
      const msg = createUserMessage(text)
      msg.meta = true
      messages.push(msg)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      options?.warn?.(
        `警告: 读取 MCP resource ${serverId}:${resource.uri} 失败 — ${msg}`,
      )
    }
  }

  return messages
}

export function promptMessagesToUserMessages(
  messages: PromptMessage[],
): UserMessage[] {
  return messages.map(message => {
    const text = extractPromptContentText(message.content)
    const userMessage = createUserMessage(text)
    userMessage.meta = true
    return userMessage
  })
}

function extractPromptContentText(content: PromptMessage['content']): string {
  if (typeof content === 'string') {
    return content
  }
  if (content.type === 'text') {
    return content.text
  }
  if (content.type === 'resource') {
    const embedded = content.resource
    if ('text' in embedded && typeof embedded.text === 'string') {
      return embedded.text
    }
    return `[resource: ${embedded.uri}]`
  }
  if (content.type === 'image') {
    return `[image: ${content.mimeType}]`
  }
  return JSON.stringify(content)
}

export function sessionHasResources(
  clients: readonly McpConnectedClient[],
): boolean {
  return clients.some(client => Boolean(client.capabilities?.resources))
}
