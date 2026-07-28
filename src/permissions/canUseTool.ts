/**
 * 写操作权限策略（canUseTool）
 *
 * - headless/pipe：只读放行；写工具默认拒绝，除非环境变量 `ALLOW_WRITE=1`
 * - REPL：只读放行；写工具弹 y/N，拒绝对齐 Claude Code 英文 REJECT_MESSAGE，并 abort 本轮
 *
 * Bash / Write / Edit / 非只读 MCP 都走这里。
 */

import type { CanUseTool, Tool, ToolUseContext } from '../Tool.js'

/**
 * headless / pipe 权限：只读允许；写工具默认拒绝，除非 ALLOW_WRITE=1
 */
export function createHeadlessCanUseTool(): CanUseTool {
  return async (tool, input) => {
    if (tool.isReadOnly(input)) {
      return { behavior: 'allow' }
    }

    if (process.env.ALLOW_WRITE === '1') {
      return { behavior: 'allow' }
    }

    return {
      behavior: 'deny',
      message:
        '写操作已拒绝：headless/pipe 默认禁止写入。设置 ALLOW_WRITE=1 可显式允许',
    }
  }
}

/** REPL 向用户提问的回调（权限确认等） */
export type AskFn = (prompt: string) => Promise<string>

/** 对齐 claude-code REJECT_MESSAGE：拒绝后模型应停下等用户指示 */
export const REJECT_MESSAGE =
  "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed."

/** @deprecated 使用 REJECT_MESSAGE */
export const USER_REJECT_MESSAGE = REJECT_MESSAGE

/**
 * REPL 权限：只读允许；写工具经 ask 确认（y/yes → allow，否则 deny + abort）
 */
export function createReplCanUseTool(ask: AskFn): CanUseTool {
  return async (tool, input, context: ToolUseContext) => {
    if (tool.isReadOnly(input)) {
      return { behavior: 'allow' }
    }

    const summary = formatWriteSummary(tool, input)
    const answer = (await ask(summary)).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') {
      return { behavior: 'allow' }
    }

    // 拒绝后 abort：orchestration 不再跑后续工具，本轮 query 随信号结束
    context.abortController?.abort('user_reject')
    return { behavior: 'deny', message: REJECT_MESSAGE }
  }
}

/** 拼给用户看的确认提示（含路径 / 命令预览） */
function formatWriteSummary(tool: Tool, input: unknown): string {
  const record =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {}
  const filePath =
    typeof record.file_path === 'string'
      ? record.file_path
      : typeof record.path === 'string'
        ? record.path
        : undefined

  if (tool.name === 'Edit' && filePath) {
    const oldString =
      typeof record.old_string === 'string' ? record.old_string : ''
    const preview =
      oldString.length > 40 ? `${oldString.slice(0, 40)}…` : oldString
    return `允许 Edit 修改 ${filePath}（替换「${preview}」）？[y/N] `
  }

  if (tool.name === 'Bash') {
    const command =
      typeof record.command === 'string' ? record.command : ''
    const preview =
      command.length > 80 ? `${command.slice(0, 80)}…` : command
    return `允许执行命令「${preview}」？[y/N] `
  }

  const content =
    typeof record.content === 'string' ? record.content : ''
  const bytes = Buffer.byteLength(content, 'utf-8')
  if (filePath) {
    return `允许 ${tool.name} 写入 ${filePath}（${bytes} 字节）？[y/N] `
  }
  return `允许调用非只读工具 ${tool.name}？[y/N] `
}
