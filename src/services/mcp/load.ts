import type { Tools } from '../../Tool.js'
import { getMcpResourceTools } from '../../tools/McpResourceTools.js'
import { getTools } from '../../tools/index.js'
import type { McpSession } from './client.js'
import { connectMcpSession, mergeTools } from './client.js'
import type { McpConnectedClient, McpSlashCommand } from './types.js'
import { loadMcpConfig } from './config.js'

export type LoadedMcp = {
  tools: Tools
  clients: McpConnectedClient[]
  commands: McpSlashCommand[]
  hasResources: boolean
  close: () => Promise<void>
}

const EMPTY_MCP: LoadedMcp = {
  tools: [],
  clients: [],
  commands: [],
  hasResources: false,
  close: async () => {},
}

/**
 * 启动时加载 MCP：无配置则返回空工具；失败 server 已在 connect 内降级
 */
export async function loadMcpTools(options?: {
  cwd?: string
  warn?: (message: string) => void
}): Promise<LoadedMcp> {
  const cwd = options?.cwd ?? process.cwd()
  const warn = options?.warn

  let config
  try {
    config = await loadMcpConfig(cwd)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    ;(warn ?? ((m: string) => console.error(m)))(`警告: ${msg}；已跳过 MCP`)
    return EMPTY_MCP
  }

  if (!config || Object.keys(config.mcpServers).length === 0) {
    return EMPTY_MCP
  }

  return connectMcpSession(config, { warn, cwd })
}

/** builtin + MCP 合并后的会话工具表（含 resource 工具） */
export function sessionTools(mcp: LoadedMcp): Tools
export function sessionTools(mcpTools: Tools): Tools
export function sessionTools(mcp: LoadedMcp | Tools = []): Tools {
  if (Array.isArray(mcp)) {
    return mergeTools(getTools(), mcp)
  }

  const loaded = mcp as LoadedMcp
  let merged = mergeTools(getTools(), loaded.tools)
  if (loaded.hasResources) {
    merged = mergeTools(merged, getMcpResourceTools())
  }
  return merged
}
