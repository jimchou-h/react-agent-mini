/**
 * Hooks 类型：配置与执行结果（PreToolUse / PostToolUse）
 */

/** 单条 command hook */
export type HookCommandEntry = {
  /** 工具名精确匹配，或 `*` 匹配全部 */
  matcher: string
  /** 在 shell 中执行的命令；stdin 收 JSON payload */
  command: string
  /** 超时毫秒；缺省 5000 */
  timeoutMs?: number
  /**
   * PreToolUse：命令非 0 且非 2 时是否按 deny 处理。
   * 缺省 false（fail-soft 放行）。
   */
  denyOnFailure?: boolean
}

export type HooksConfig = {
  PreToolUse?: HookCommandEntry[]
  PostToolUse?: HookCommandEntry[]
}

export type HookEventName = 'PreToolUse' | 'PostToolUse'

export type HookPayload = {
  hook_event_name: HookEventName
  tool_name: string
  tool_input: unknown
  /** PostToolUse：工具结果摘要（成功/失败文本） */
  tool_result?: string
  tool_is_error?: boolean
}

export type PreHookDecision = {
  behavior: 'allow' | 'deny'
  message?: string
}

export type HookCommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type HookExecFn = (
  command: string,
  payload: HookPayload,
  options: { timeoutMs: number },
) => Promise<HookCommandResult>
