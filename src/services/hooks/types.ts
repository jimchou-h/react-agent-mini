/**
 * Hooks 类型：配置与执行结果（PreToolUse / PostToolUse / Stop）
 */

/** 单条 command hook（工具前后） */
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

/** Stop：仅 command；matcher 忽略（一律执行） */
export type StopHookEntry = {
  command: string
  timeoutMs?: number
}

export type HooksConfig = {
  PreToolUse?: HookCommandEntry[]
  PostToolUse?: HookCommandEntry[]
  Stop?: StopHookEntry[]
}

export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'Stop'

export type ToolHookPayload = {
  hook_event_name: 'PreToolUse' | 'PostToolUse'
  tool_name: string
  tool_input: unknown
  /** PostToolUse：工具结果摘要（成功/失败文本） */
  tool_result?: string
  tool_is_error?: boolean
}

export type StopHookPayload = {
  hook_event_name: 'Stop'
  /** 因 blocking 再次进入 Stop 时为 true（#89 接线；#88 默认 false） */
  stop_hook_active?: boolean
}

export type HookPayload = ToolHookPayload | StopHookPayload

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

/** runStop 单次观察结果（#88 不据此续跑） */
export type StopHookOutcome = {
  exitCode: number
  stdout: string
  stderr: string
}

export type StopRunResult = {
  /** 实际调用的 Stop command 次数 */
  count: number
  outcomes: StopHookOutcome[]
}
