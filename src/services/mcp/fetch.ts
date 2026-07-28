/**
 * MCP Resources / Prompts 的 Host 读写层
 *
 * 职责一句话：
 * - Resources：问 server「有哪些材料」「读某一份材料」
 * - Prompts：问 server「有哪些开场模板」，并变成 REPL slash 能跑的命令
 * - slash：先 `prompts/get`，再仅按 `@server:uri` 按需挂 Resource（无引用则不自动挂载）
 *
 * 约定：list 失败或没能力 → 返回空数组（不拖垮会话）；
 *       read 失败或没能力 → 抛错（调用方做成 tool_result 错误）；
 *       mention read 失败 → warn 跳过，不中断 slash。
 *       Host 不做「无 mention 全量挂载」（claude-code 无此行为）。
 */

import type { PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { createUserMessage } from '../../utils/messages.js'
import type { UserMessage } from '../../types/message.js'
import { normalizeNameForMCP } from './adapter.js'
import type {
  McpConnectedClient,
  McpResourceEntry,
  McpSlashCommand,
} from './types.js'

/** 挂进模型上下文的单份 Resource 正文上限，避免撑爆上下文 */
export const MCP_RESOURCE_INJECT_MAX_CHARS = 100_000

/** 文本中的 MCP 资源引用：`@server:uri` */
export type McpResourceMention = {
  server: string
  uri: string
}

/**
 * 从文本解析 `@server:uri`（对齐 claude-code mention）。
 * `server` 与 `uri` 以第一个 `:` 分隔，故 uri 可含 `://`。
 */
export function extractMcpResourceMentions(
  content: string,
): McpResourceMention[] {
  const atMentionRegex = /(^|\s)@([^\s]+:[^\s]+)\b/g
  const seen = new Set<string>()
  const out: McpResourceMention[] = []
  let match: RegExpExecArray | null
  while ((match = atMentionRegex.exec(content)) !== null) {
    const raw = match[2]!
    const colon = raw.indexOf(':')
    if (colon <= 0 || colon >= raw.length - 1) continue
    const server = raw.slice(0, colon)
    const uri = raw.slice(colon + 1)
    const key = `${server}\0${uri}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ server, uri })
  }
  return out
}

/**
 * 向某个 server 要 Resource 列表。
 * server 没声明 resources、或 list 报错 → `[]`（fail-soft）。
 */
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

/**
 * 向某个 server 要 Prompt 列表，并转成 REPL 可用的 slash 命令对象。
 * server 没声明 prompts、或 list 报错 → `[]`。
 *
 * 每个命令的 `run()` 内部会再调 `prompts/get`，把模板变成 meta user 消息。
 */
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
          // 「石家庄 2」→ 按 argNames 顺序 zip 成 { city: '石家庄', days: '2' }
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

/**
 * 读取某一份 Resource 的内容。
 * - 文本：放进 `text`
 * - 二进制 blob：不把 base64 塞给模型，只给占位说明（`blobSavedTo`）
 * - 无 resources 能力：抛错
 */
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
 * 按 `@server:uri` 引用精确读取 Resource，转为 meta 消息。
 * server 缺失 / 无能力 / read 失败 → warn 跳过，不中断其它引用。
 */
export async function loadReferencedResourcesAsMetaMessages(
  clients: readonly McpConnectedClient[],
  refs: readonly McpResourceMention[],
  options?: { warn?: (msg: string) => void; maxChars?: number },
): Promise<UserMessage[]> {
  const messages: UserMessage[] = []
  const seen = new Set<string>()

  for (const ref of refs) {
    const key = `${ref.server}\0${ref.uri}`
    if (seen.has(key)) continue
    seen.add(key)

    const client = clients.find(item => item.serverId === ref.server)
    if (!client?.capabilities?.resources) {
      options?.warn?.(
        `警告: MCP resource 引用 @${ref.server}:${ref.uri} 无法读取 — server 未连接或不支持 resources`,
      )
      continue
    }

    const msg = await readResourceAsMetaMessage(
      client,
      ref.uri,
      undefined,
      options,
    )
    if (msg) messages.push(msg)
  }

  return messages
}

/**
 * 从 user/prompt 消息文本解析 `@server:uri` 并按需挂载。
 * 用于 MCP slash 的 get 结果，也用于普通 REPL / headless 用户原文。
 * 无任何引用 → `[]`（不对齐「全量挂载」；与 claude-code 一致）。
 */
export async function resolvePromptResourceMessages(
  clients: readonly McpConnectedClient[],
  promptMessages: readonly UserMessage[],
  options?: { warn?: (msg: string) => void; maxChars?: number },
): Promise<UserMessage[]> {
  const text = promptMessages
    .flatMap(message => message.content)
    .filter(
      (block): block is Extract<(typeof promptMessages)[number]['content'][number], { type: 'text' }> =>
        block.type === 'text',
    )
    .map(block => block.text)
    .join('\n')

  const refs = extractMcpResourceMentions(text)
  if (refs.length === 0) {
    return []
  }
  return loadReferencedResourcesAsMetaMessages(clients, refs, options)
}

async function readResourceAsMetaMessage(
  client: McpConnectedClient,
  uri: string,
  name: string | undefined,
  options?: { warn?: (msg: string) => void; maxChars?: number },
): Promise<UserMessage | null> {
  const maxChars = options?.maxChars ?? MCP_RESOURCE_INJECT_MAX_CHARS
  try {
    const contents = await readMcpResource(client, uri)
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

    if (!body) return null

    const namePart = name ? ` name=${name}` : ''
    const text = [
      '以下材料来自 MCP Resource，请严格遵守：',
      `server=${client.serverId} uri=${uri}${namePart}`,
      '',
      body,
    ].join('\n')
    const msg = createUserMessage(text)
    msg.meta = true
    return msg
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    options?.warn?.(
      `警告: 读取 MCP resource ${client.serverId}:${uri} 失败 — ${msg}`,
    )
    return null
  }
}

/**
 * 把 MCP `prompts/get` 返回的 messages 转成本会话的 user 消息，并标 meta。
 * meta 表示：这不是用户亲手打的字，是 Host 注入的模板/材料。
 */
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

/** 把 prompt 里各种 content 形态压成一段纯文本给模型看 */
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

/** 是否有任一 server 声明了 resources（决定要不要往工具表塞 List/Read 两个内置工具） */
export function sessionHasResources(
  clients: readonly McpConnectedClient[],
): boolean {
  return clients.some(client => Boolean(client.capabilities?.resources))
}
