import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'

/** 单个 stdio MCP server 配置（claude-code `.mcp.json` 子集） */
export type McpServerConfig = {
  command: string
  args?: string[]
  env?: Record<string, string>
}

/** 项目 MCP 配置根对象 */
export type McpConfig = {
  mcpServers: Record<string, McpServerConfig>
}

/**
 * 解析 MCP 配置文件路径
 *
 * 优先 `MCP_CONFIG` 环境变量；否则为 `<cwd>/.mcp.json`。
 */
export function resolveMcpConfigPath(cwd = process.cwd()): string {
  const override = process.env.MCP_CONFIG?.trim()
  if (override) {
    return isAbsolute(override) ? override : resolve(cwd, override)
  }
  return resolve(cwd, '.mcp.json')
}

/**
 * 加载 `.mcp.json`（或 `MCP_CONFIG`）
 *
 * @returns 解析后的配置；文件不存在时返回 `undefined`（跳过 MCP）
 * @throws 非法 JSON 或结构无效时抛出可读错误
 */
export async function loadMcpConfig(
  cwd = process.cwd(),
): Promise<McpConfig | undefined> {
  const path = resolveMcpConfigPath(cwd)

  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as NodeJS.ErrnoException).code)
        : ''
    if (code === 'ENOENT') {
      return undefined
    }
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`MCP 配置 JSON 无效: ${path}`)
  }

  return parseMcpConfig(parsed, path)
}

function parseMcpConfig(value: unknown, path: string): McpConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`MCP 配置结构无效: ${path}（需要对象）`)
  }

  const root = value as Record<string, unknown>
  const servers = root.mcpServers
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    throw new Error(`MCP 配置结构无效: ${path}（需要 mcpServers 对象）`)
  }

  const mcpServers: Record<string, McpServerConfig> = {}
  for (const [id, entry] of Object.entries(
    servers as Record<string, unknown>,
  )) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`MCP server "${id}" 配置无效: 需要对象`)
    }
    const server = entry as Record<string, unknown>
    if (typeof server.command !== 'string' || !server.command.trim()) {
      throw new Error(`MCP server "${id}" 配置无效: 需要非空 command 字符串`)
    }
    if (server.args !== undefined && !Array.isArray(server.args)) {
      throw new Error(`MCP server "${id}" 配置无效: args 须为字符串数组`)
    }
    if (server.args && !server.args.every(a => typeof a === 'string')) {
      throw new Error(`MCP server "${id}" 配置无效: args 须为字符串数组`)
    }
    if (
      server.env !== undefined &&
      (typeof server.env !== 'object' ||
        server.env === null ||
        Array.isArray(server.env))
    ) {
      throw new Error(`MCP server "${id}" 配置无效: env 须为对象`)
    }

    mcpServers[id] = {
      command: server.command,
      ...(server.args ? { args: server.args as string[] } : {}),
      ...(server.env
        ? { env: server.env as Record<string, string> }
        : {}),
    }
  }

  return { mcpServers }
}
