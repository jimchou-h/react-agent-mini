import type { ToolResultBlock, ToolUseBlock } from '../types/message.js'

/** 解析参数时需忽略的 CLI 标志位 */
export const CLI_FLAGS = new Set(['-p', '--mock', '-m'])

/**
 * 从 process.argv 解析用户问题文本
 *
 * @returns 用户问题；pipe 模式（-p）返回 null，由 stdin 提供
 */
export function parseUserPrompt(argv: string[]): string | null {
  if (argv.includes('-p')) {
    return null
  }

  const dashIndex = argv.indexOf('--')
  if (dashIndex >= 0 && argv[dashIndex + 1]) {
    return argv
      .slice(dashIndex + 1)
      .filter(a => !CLI_FLAGS.has(a))
      .join(' ')
      .trim()
  }

  const positional = argv.filter(a => !a.startsWith('-') && a !== '--')
  if (positional.length > 0) {
    return positional.join(' ').trim()
  }

  return null
}

/** 是否启用 mock 模型（QUERY_MOCK=1、--mock、-m） */
export function isMockMode(argv: string[]): boolean {
  return (
    process.env.QUERY_MOCK === '1' ||
    argv.includes('--mock') ||
    argv.includes('-m')
  )
}

/**
 * 工具开始执行前的中文状态行 — 对齐 cli-entrypoint spec
 *
 * @example `[工具] Read: README.md`
 */
export function formatToolStartStatus(block: ToolUseBlock): string {
  if (block.name === 'Read' && typeof block.input.path === 'string') {
    return `[工具] Read: ${block.input.path}`
  }

  if (block.name === 'Echo' && typeof block.input.message === 'string') {
    return `[工具] Echo: ${block.input.message}`
  }

  return `[工具] ${block.name}`
}

/**
 * 工具执行完成后的简短结果行（错误时更详细）
 */
export function formatToolResultStatus(block: ToolResultBlock): string | null {
  if (block.is_error) {
    const preview =
      block.content.length > 80
        ? `${block.content.slice(0, 80)}…`
        : block.content
    return `[工具] 错误 — ${preview}`
  }

  return null
}
