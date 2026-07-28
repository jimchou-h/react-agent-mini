/**
 * MCP 启动入口：读配置 → 连接 → 给 CLI 用的会话工具表
 *
 * `loadMcpTools`：进程启动时调用一次。
 * `sessionTools`：内置工具 + MCP tools；若有 resources 能力再追加 List/Read 两个内置工具。
 */

import type { Tools } from '../../Tool.js'
import { getMcpResourceTools } from '../../tools/McpResourceTools.js'
import { getTools } from '../../tools/index.js'
import { connectMcpSession, mergeTools } from './client.js'
import type { McpConnectedClient, McpSlashCommand } from './types.js'
import { loadMcpConfig } from './config.js'

/** 启动加载 MCP 后的统一返回值（无配置时也是这个形状，字段为空） */
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
 * 启动时加载 MCP。
 * 没有 `.mcp.json` / 配置非法：返回空会话，不抛错打断启动。
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

/**
 * 组装本轮会话最终工具表。
 *
 * - 传 `LoadedMcp`：builtin + MCP tools；`hasResources` 为真时再挂上 List/Read
 * - 传纯 `Tools` 数组：兼容旧调用，只做 builtin + 该数组合并
 */
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
