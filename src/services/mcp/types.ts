import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js'
import type { UserMessage } from '../../types/message.js'

/** 已连接 MCP server 句柄（供 tools / slash 路由） */
export type McpConnectedClient = {
  serverId: string
  client: Client
  capabilities: ServerCapabilities | undefined
  close: () => Promise<void>
}

export type McpResourceEntry = {
  uri: string
  name: string
  mimeType?: string
  description?: string
  server: string
}

/** REPL slash 可用的 MCP prompt 命令 */
export type McpSlashCommand = {
  serverId: string
  promptName: string
  /** 内部标识：`mcp__<server>__<prompt>` */
  internalName: string
  description: string
  argNames: string[]
  /** slash 输入面：`server:prompt (MCP)` */
  slashLabel: string
  run: (argsLine: string) => Promise<UserMessage[]>
}
