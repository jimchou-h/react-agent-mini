/**
 * MCP Prompt 的 REPL 输入解析
 *
 * 用户在 REPL 里敲类似 `/calc:plan_trip 石家庄 2`，
 * 这里负责认出「这是哪条已注册的 MCP prompt」以及「后面参数原文是什么」。
 */

import type { McpSlashCommand } from './types.js'

export type ParsedMcpSlash = {
  /** 命中的已注册命令 */
  command: McpSlashCommand
  /** slash 后面留给 prompt 的参数原文（尚未按名拆开） */
  argsLine: string
}

/**
 * 解析一行是否为 MCP slash。
 *
 * 支持两种写法（第二种更省事）：
 * - `/calc:plan_trip (MCP) 石家庄 2` — 对齐 Claude Code 用户面
 * - `/calc:plan_trip 石家庄 2` — 省略 `(MCP)`，仅当该命令已注册时才算命中
 *
 * 未注册 / 格式不对 → `null`（由 REPL 当普通未知 slash 处理）。
 */
export function parseMcpSlashCommand(
  line: string,
  commands: readonly McpSlashCommand[],
): ParsedMcpSlash | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('/')) {
    return null
  }

  // 带 (MCP) 标记
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

/** 用 serverId + promptName 在已注册命令里查找；找不到返回 null */
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

/** 生成 `/help` 里 MCP prompts 那几行说明 */
export function formatMcpHelpLines(commands: readonly McpSlashCommand[]): string[] {
  if (commands.length === 0) {
    return []
  }
  return commands.map(cmd => `  /${cmd.slashLabel} [args…] — ${cmd.description || cmd.promptName}`)
}
