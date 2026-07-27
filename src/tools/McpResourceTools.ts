import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { fetchResourcesForClient, readMcpResource } from '../services/mcp/fetch.js'
import type { McpConnectedClient, McpResourceEntry } from '../services/mcp/types.js'

export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool'
export const READ_MCP_RESOURCE_TOOL_NAME = 'ReadMcpResourceTool'
export const MCP_RESOURCE_MAX_CHARS = 100_000

const listInputSchema = z.object({
  server: z
    .string()
    .optional()
    .describe('Optional MCP server name to filter resources by'),
})

const readInputSchema = z.object({
  server: z.string().describe('The MCP server name'),
  uri: z.string().describe('The resource URI to read'),
})

function getClients(context: { mcpClients?: readonly McpConnectedClient[] }) {
  return context.mcpClients ?? []
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return `${text.slice(0, maxChars)}\n\n[truncated: ${text.length} chars total]`
}

export const ListMcpResourcesTool: Tool<typeof listInputSchema> = {
  name: LIST_MCP_RESOURCES_TOOL_NAME,
  description:
    'List available resources from connected MCP servers. Each entry includes a server field.',
  inputSchema: listInputSchema,

  async call(input, context) {
    const clients = getClients(context)
    const targetClients = input.server
      ? clients.filter(client => client.serverId === input.server)
      : clients

    if (input.server && targetClients.length === 0) {
      throw new Error(
        `Server "${input.server}" not found. Available servers: ${clients.map(c => c.serverId).join(', ') || '(none)'}`,
      )
    }

    const all: McpResourceEntry[] = []
    for (const client of targetClients) {
      const resources = await fetchResourcesForClient(client)
      all.push(...resources)
    }

    if (all.length === 0) {
      return {
        data: 'No resources found. MCP servers may still provide tools.',
      }
    }

    return { data: JSON.stringify(all, null, 2) }
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  isEnabled() {
    return true
  },
}

export const ReadMcpResourceTool: Tool<typeof readInputSchema> = {
  name: READ_MCP_RESOURCE_TOOL_NAME,
  description: 'Read a specific MCP resource by server name and URI.',
  inputSchema: readInputSchema,

  async call(input, context) {
    const clients = getClients(context)
    const client = clients.find(item => item.serverId === input.server)
    if (!client) {
      throw new Error(
        `Server "${input.server}" not found. Available servers: ${clients.map(c => c.serverId).join(', ') || '(none)'}`,
      )
    }
    if (!client.capabilities?.resources) {
      throw new Error(`Server "${input.server}" does not support resources`)
    }

    const contents = await readMcpResource(client, input.uri)
    const formatted = contents
      .map(item => {
        if (item.text) {
          return truncateText(item.text, MCP_RESOURCE_MAX_CHARS)
        }
        if (item.blobSavedTo) {
          return item.blobSavedTo
        }
        return JSON.stringify(item)
      })
      .join('\n\n')

    return { data: formatted || '(empty resource)' }
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  isEnabled() {
    return true
  },
}

export function getMcpResourceTools(): Tool[] {
  return [ListMcpResourcesTool, ReadMcpResourceTool]
}
