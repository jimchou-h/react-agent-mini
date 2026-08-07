/**
 * 写操作权限策略（canUseTool）
 *
 * - headless/pipe：只读放行；写工具默认拒绝，除非环境变量 `ALLOW_WRITE=1` 或会话规则命中
 * - REPL：只读放行；写工具先查会话规则，未命中再弹 y/N；拒绝对齐 Claude Code 英文 REJECT_MESSAGE，并 abort 本轮
 *
 * Bash / Write / Edit / 非只读 MCP 都走这里。
 */

import type { CanUseTool, Tool, ToolUseContext } from '../Tool.js'

/** 会话级 allow 规则（进程内，不跨重启） */
export type SessionPermissionRules = {
  /** 记住允许某工具；可选路径 glob（`*` = 任意字符） */
  allow(toolName: string, pathPattern?: string): void
  /** 当前 input 是否命中某条 allow 规则 */
  matches(tool: Tool, input: unknown): boolean
  clear(): void
}

type AllowRule = {
  toolName: string
  pathPattern?: string
}

/**
 * 创建会话内存规则表。匹配工具名；若规则带 pathPattern，则对 file_path/path 做简单 glob。
 */
export function createSessionPermissionRules(): SessionPermissionRules {
  const rules: AllowRule[] = []
  return {
    allow(toolName, pathPattern) {
      rules.push({ toolName, pathPattern })
    },
    matches(tool, input) {
      const filePath = extractFilePath(input)
      return rules.some(rule => {
        if (rule.toolName !== tool.name) return false
        if (rule.pathPattern === undefined) return true
        if (filePath === undefined) return false
        return matchPathGlob(rule.pathPattern, filePath)
      })
    },
    clear() {
      rules.length = 0
    },
  }
}

function extractFilePath(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const record = input as Record<string, unknown>
  if (typeof record.file_path === 'string') return record.file_path
  if (typeof record.path === 'string') return record.path
  return undefined
}

/** 极简 glob：`*` → 任意字符；路径统一为正斜杠再比 */
function matchPathGlob(pattern: string, path: string): boolean {
  const norm = (s: string) => s.replace(/\\/g, '/')
  const escaped = norm(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(norm(path))
}

/**
 * headless / pipe 权限：只读允许；写工具默认拒绝，除非 ALLOW_WRITE=1 或会话规则命中
 */
export function createHeadlessCanUseTool(
  rules?: SessionPermissionRules,
): CanUseTool {
  return async (tool, input) => {
    if (tool.isReadOnly(input)) {
      return { behavior: 'allow' }
    }

    if (rules?.matches(tool, input)) {
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
 * REPL 权限：只读允许；写工具先查会话规则，未命中再经 ask 确认
 *（y/yes → allow；a/always → 写入会话规则并 allow；否则 deny + abort）
 */
export function createReplCanUseTool(
  ask: AskFn,
  rules?: SessionPermissionRules,
): CanUseTool {
  return async (tool, input, context: ToolUseContext) => {
    if (tool.isReadOnly(input)) {
      return { behavior: 'allow' }
    }

    if (rules?.matches(tool, input)) {
      return { behavior: 'allow' }
    }

    const summary = formatWriteSummary(tool, input, Boolean(rules))
    const answer = (await ask(summary)).trim().toLowerCase()
    if (answer === 'y' || answer === 'yes') {
      return { behavior: 'allow' }
    }
    if (rules && (answer === 'a' || answer === 'always')) {
      const filePath = extractFilePath(input)
      rules.allow(tool.name, filePath)
      return { behavior: 'allow' }
    }

    // 拒绝后 abort：orchestration 不再跑后续工具，本轮 query 随信号结束
    context.abortController?.abort('user_reject')
    return { behavior: 'deny', message: REJECT_MESSAGE }
  }
}

/** 拼给用户看的确认提示（含路径 / 命令预览） */
function formatWriteSummary(
  tool: Tool,
  input: unknown,
  withAlwaysOption = false,
): string {
  const suffix = withAlwaysOption ? '[y/a/N]' : '[y/N]'
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
    return `允许 Edit 修改 ${filePath}（替换「${preview}」）？${suffix} `
  }

  if (tool.name === 'Bash') {
    const command =
      typeof record.command === 'string' ? record.command : ''
    const preview =
      command.length > 80 ? `${command.slice(0, 80)}…` : command
    return `允许执行命令「${preview}」？${suffix} `
  }

  const content =
    typeof record.content === 'string' ? record.content : ''
  const bytes = Buffer.byteLength(content, 'utf-8')
  if (filePath) {
    return `允许 ${tool.name} 写入 ${filePath}（${bytes} 字节）？${suffix} `
  }
  return `允许调用非只读工具 ${tool.name}？${suffix} `
}
