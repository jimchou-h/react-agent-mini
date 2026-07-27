import type { McpSlashCommand } from './types.js'

export type ParsedMcpSlash = {
  command: McpSlashCommand
  argsLine: string
}

/**
 * 解析 MCP slash（两种写法，后者更省事）：
 * - `/<server>:<prompt> (MCP) [args...]`（对齐 claude-code 用户面）
 * - `/<server>:<prompt> [args...]`（省略 `(MCP)`，仅当命令已注册时命中）
 *
 * 例：`/calc:plan_trip (MCP) Tokyo 3` 或 `/calc:plan_trip Tokyo 3`
 */
export function parseMcpSlashCommand(
  line: string,
  commands: readonly McpSlashCommand[],
): ParsedMcpSlash | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  // 优先匹配带 (MCP) 标记的写法
  const withMarker = trimmed.match(
    /^\/([^:\s]+):(\S+)\s+\(MCP\)(?:\s+(.*))?$/i,
  )
  if (withMarker) {
    return resolveMcpSlash(commands, withMarker[1]!, withMarker[2]!, withMarker[3] ?? '')
  }

  // 省略 (MCP)：`/server:prompt args…`
  const bare = trimmed.match(/^\/([^:\s]+):(\S+)(?:\s+(.*))?$/)
  if (bare) {
    return resolveMcpSlash(commands, bare[1]!, bare[2]!, bare[3] ?? '')
  }

  return null
}

function resolveMcpSlash(
  commands: readonly McpSlashCommand[],
  serverId: string,
  promptName: string,
  argsLine: string,
): ParsedMcpSlash | null {
  const slashLabel = `${serverId}:${promptName} (MCP)`
  const command = commands.find(
    cmd =>
      cmd.slashLabel === slashLabel ||
      (cmd.serverId === serverId && cmd.promptName === promptName),
  )
  if (!command) {
    return null
  }
  return { command, argsLine }
}

export function formatMcpHelpLines(commands: readonly McpSlashCommand[]): string[] {
  if (commands.length === 0) {
    return []
  }
  return commands.map(cmd => `  /${cmd.slashLabel} [args…] — ${cmd.description || cmd.promptName}`)
}
