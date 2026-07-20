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
 * REPL 权限策略：只读允许；写工具经 ask 确认（y/yes → allow）
 */
export function createReplCanUseTool(ask: AskFn): CanUseTool {
  return async (tool, input, _context: ToolUseContext) => {
    if (tool.isReadOnly(input)) {
      return { behavior: 'allow' }
    }

    const summary = formatWriteSummary(tool, input)
    const answer = (await ask(summary)).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') {
      return { behavior: 'allow' }
    }

    return {
      behavior: 'deny',
      message: '用户拒绝了写操作',
    }
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
