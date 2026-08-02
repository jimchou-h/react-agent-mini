/**
 * Hook 执行：matcher、命令、Pre deny / Post fail-soft
 */

import { trace } from '../../utils/trace.js'
import type {
  HookCommandEntry,
  HookExecFn,
  HookPayload,
  HooksConfig,
  PreHookDecision,
  StopHookPayload,
  StopRunResult,
} from './types.js'

export const DEFAULT_HOOK_TIMEOUT_MS = 5_000

/** 工具名是否匹配 hook matcher（`*` 或精确名） */
export function matchHook(matcher: string, toolName: string): boolean {
  if (matcher === '*' || matcher === '') return true
  return matcher === toolName
}

export function entriesForEvent(
  config: HooksConfig | null | undefined,
  event: 'PreToolUse' | 'PostToolUse',
  toolName: string,
): HookCommandEntry[] {
  if (!config) return []
  const list = config[event] ?? []
  return list.filter(e => matchHook(e.matcher, toolName))
}

function parseDecisionFromStdout(stdout: string): Partial<PreHookDecision> {
  const lines = stdout
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]!) as Record<string, unknown>
      const decision =
        obj.permissionDecision ?? obj.decision ?? obj.behavior
      if (decision === 'deny') {
        return {
          behavior: 'deny',
          message:
            typeof obj.permissionDecisionReason === 'string'
              ? obj.permissionDecisionReason
              : typeof obj.message === 'string'
                ? obj.message
                : 'blocked by PreToolUse hook',
        }
      }
      if (decision === 'allow') {
        return { behavior: 'allow' }
      }
    } catch {
      // 非 JSON 行忽略
    }
  }
  return {}
}

/**
 * 默认用 shell 跑 hook 命令；stdin 写入 payload JSON。
 * Windows / Unix 均走 `shell: true`。
 */
export const defaultHookExec: HookExecFn = async (
  command,
  payload,
  options,
) => {
  const cmd =
    process.platform === 'win32'
      ? (['cmd', '/d', '/s', '/c', command] as string[])
      : (['/bin/sh', '-c', command] as string[])
  const proc = Bun.spawn(cmd, {
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  proc.stdin.write(JSON.stringify(payload))
  proc.stdin.end()

  const timeout = options.timeoutMs
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try {
      proc.kill()
    } catch {
      // ignore
    }
  }, timeout)

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  clearTimeout(timer)

  return {
    exitCode: timedOut ? 124 : exitCode,
    stdout,
    stderr,
  }
}

export type RunHooksOptions = {
  exec?: HookExecFn
}

/**
 * 运行匹配的 PreToolUse hooks；任一 deny / exit 2 → deny。
 */
export async function runPreToolUse(
  config: HooksConfig | null | undefined,
  toolName: string,
  toolInput: unknown,
  options?: RunHooksOptions,
): Promise<PreHookDecision> {
  const entries = entriesForEvent(config, 'PreToolUse', toolName)
  if (entries.length === 0) return { behavior: 'allow' }

  const exec = options?.exec ?? defaultHookExec
  const payload: HookPayload = {
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
  }

  for (const entry of entries) {
    const timeoutMs = entry.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS
    try {
      const result = await exec(entry.command, payload, { timeoutMs })
      trace('hooks.pre', {
        tool: toolName,
        matcher: entry.matcher,
        exitCode: result.exitCode,
      })

      const fromStdout = parseDecisionFromStdout(result.stdout)
      if (fromStdout.behavior === 'deny') {
        return {
          behavior: 'deny',
          message: fromStdout.message ?? 'blocked by PreToolUse hook',
        }
      }
      if (result.exitCode === 2) {
        return {
          behavior: 'deny',
          message:
            result.stderr.trim() ||
            result.stdout.trim() ||
            'blocked by PreToolUse hook (exit 2)',
        }
      }
      if (result.exitCode !== 0) {
        if (entry.denyOnFailure) {
          return {
            behavior: 'deny',
            message:
              result.stderr.trim() ||
              `PreToolUse hook failed (exit ${result.exitCode})`,
          }
        }
        // fail-soft
        continue
      }
    } catch (err) {
      trace('hooks.pre_error', {
        tool: toolName,
        error: err instanceof Error ? err.message : String(err),
      })
      if (entry.denyOnFailure) {
        return {
          behavior: 'deny',
          message:
            err instanceof Error ? err.message : 'PreToolUse hook error',
        }
      }
    }
  }

  return { behavior: 'allow' }
}

/**
 * 运行 PostToolUse；失败只记警告，不改变 tool_result。
 */
export async function runPostToolUse(
  config: HooksConfig | null | undefined,
  toolName: string,
  toolInput: unknown,
  toolResult: { text: string; isError: boolean },
  options?: RunHooksOptions,
): Promise<void> {
  const entries = entriesForEvent(config, 'PostToolUse', toolName)
  if (entries.length === 0) return

  const exec = options?.exec ?? defaultHookExec
  const payload: HookPayload = {
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_result: toolResult.text,
    tool_is_error: toolResult.isError,
  }

  for (const entry of entries) {
    const timeoutMs = entry.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS
    try {
      const result = await exec(entry.command, payload, { timeoutMs })
      trace('hooks.post', {
        tool: toolName,
        matcher: entry.matcher,
        exitCode: result.exitCode,
      })
      if (result.exitCode !== 0) {
        console.error(
          `[hooks] PostToolUse failed for ${toolName} (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`,
        )
      } else if (result.stderr.trim()) {
        // 成功时仍透出 hook 的 stderr（示例日志 / 审计输出）
        console.error(result.stderr.trim())
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[hooks] PostToolUse error for ${toolName}: ${msg}`)
      trace('hooks.post_error', { tool: toolName, error: msg })
    }
  }
}

/**
 * 从 Stop stdout 解析 continue / decision（末行 JSON，对齐 PreToolUse）。
 */
function parseStopStdout(stdout: string): {
  preventContinuation?: boolean
  stopReason?: string
  blockReason?: string
} {
  const lines = stdout
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]!) as Record<string, unknown>
      const out: {
        preventContinuation?: boolean
        stopReason?: string
        blockReason?: string
      } = {}
      if (obj.continue === false) {
        out.preventContinuation = true
        if (typeof obj.stopReason === 'string') out.stopReason = obj.stopReason
      }
      if (obj.decision === 'block') {
        out.blockReason =
          typeof obj.reason === 'string' ? obj.reason : 'Blocked by Stop hook'
      }
      if (
        out.preventContinuation ||
        out.blockReason !== undefined
      ) {
        return out
      }
    } catch {
      // 非 JSON 行忽略
    }
  }
  return {}
}

/**
 * 运行 Stop hooks（顶层 completed 时由 query 调用）。
 * 聚合：任一 `continue: false` → preventContinuation；否则收集 blocking feedback。
 */
export async function runStop(
  config: HooksConfig | null | undefined,
  options?: RunHooksOptions & { stopHookActive?: boolean },
): Promise<StopRunResult> {
  const entries = config?.Stop ?? []
  if (entries.length === 0) {
    return { count: 0, outcomes: [], preventContinuation: false }
  }

  const exec = options?.exec ?? defaultHookExec
  const payload: StopHookPayload = {
    hook_event_name: 'Stop',
    stop_hook_active: options?.stopHookActive === true,
  }

  const outcomes: StopRunResult['outcomes'] = []
  let preventContinuation = false
  let stopReason: string | undefined
  const blockingParts: string[] = []

  for (const entry of entries) {
    const timeoutMs = entry.timeoutMs ?? DEFAULT_HOOK_TIMEOUT_MS
    try {
      const result = await exec(entry.command, payload, { timeoutMs })
      trace('hooks.stop', {
        exitCode: result.exitCode,
        active: payload.stop_hook_active === true,
      })
      outcomes.push({
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      })

      const parsed = parseStopStdout(result.stdout)
      if (parsed.preventContinuation) {
        preventContinuation = true
        if (parsed.stopReason) stopReason = parsed.stopReason
        continue
      }
      if (parsed.blockReason) {
        blockingParts.push(parsed.blockReason)
        continue
      }
      if (result.exitCode === 2) {
        blockingParts.push(
          result.stderr.trim() ||
            result.stdout.trim() ||
            'Stop hook blocked (exit 2)',
        )
        continue
      }
      if (result.exitCode !== 0) {
        console.error(
          `[hooks] Stop failed (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[hooks] Stop error: ${msg}`)
      trace('hooks.stop_error', { error: msg })
      outcomes.push({ exitCode: 1, stdout: '', stderr: msg })
    }
  }

  return {
    count: outcomes.length,
    outcomes,
    preventContinuation,
    ...(stopReason ? { stopReason } : {}),
    ...(!preventContinuation && blockingParts.length > 0
      ? { blockingFeedback: blockingParts.join('\n') }
      : {}),
  }
}
