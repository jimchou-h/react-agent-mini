import type { CanUseTool, Tool, ToolUseContext } from '../Tool.js'

/**
 * headless / pipe 权限策略：只读允许；写工具默认拒绝，除非 ALLOW_WRITE=1
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

export type AskFn = (prompt: string) => Promise<string>

/**
 * 用户拒绝写操作时的 tool_result 文案 — 对齐 claude-code REJECT_MESSAGE 语义
 */
export const USER_REJECT_MESSAGE =
  '用户拒绝了该工具调用（例如文件未被写入）。请停止当前操作，等待用户下一步指示。'

/**
 * REPL 权限策略：只读允许；写工具经 ask 确认（y/yes → allow）
 *
 * 用户输入 n 时 deny，并 abort 本轮 AbortController，使 query 循环结束
 *（对齐 claude-code PermissionContext.cancelAndAbort）。
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

    context.abortController?.abort('user_reject')
    return { behavior: 'deny', message: USER_REJECT_MESSAGE }
  }
}

function formatWriteSummary(tool: Tool, input: unknown): string {
  const record =
    input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {}
  const path =
    typeof record.path === 'string' ? record.path : '(unknown path)'
  const content =
    typeof record.content === 'string' ? record.content : ''
  const bytes = Buffer.byteLength(content, 'utf-8')
  return `允许 ${tool.name} 写入 ${path}（${bytes} 字节）？[y/N] `
}
