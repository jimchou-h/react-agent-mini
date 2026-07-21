import type { Tools } from '../../Tool.js'
import { getTools } from '../../tools/index.js'
import { connectMcpSession, mergeTools } from './client.js'
import { loadMcpConfig } from './config.js'

export type LoadedMcp = {
  tools: Tools
  close: () => Promise<void>
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
    return { tools: [], close: async () => {} }
  }

  if (!config || Object.keys(config.mcpServers).length === 0) {
    return { tools: [], close: async () => {} }
  }

  return connectMcpSession(config, { warn, cwd })
}

/** builtin + MCP 合并后的会话工具表 */
export function sessionTools(mcpTools: Tools = []): Tools {
  return mergeTools(getTools(), mcpTools)
}
