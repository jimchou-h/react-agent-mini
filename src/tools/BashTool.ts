import { spawn } from 'node:child_process'
import { z } from 'zod'
import type { Tool } from '../Tool.js'

/** 尽力终止子进程树：Windows 用 taskkill /T，其余用 SIGKILL */
function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === 'win32' && child.pid != null) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        windowsHide: true,
      })
    } catch {
      child.kill('SIGKILL')
    }
    return
  }
  child.kill('SIGKILL')
}

/** 单次 Bash 输出（stdout+stderr 合并后）保留字符上限 */
export const MAX_BASH_OUTPUT_CHARS = 50_000

/** 默认命令超时（毫秒） — 对齐 claude-code */
export const DEFAULT_BASH_TIMEOUT_MS = 120_000

/** 超时硬上限（毫秒） */
export const MAX_BASH_TIMEOUT_MS = 600_000

const bashInputSchema = z.object({
  command: z.string().min(1).describe('要执行的 shell 命令'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(`超时毫秒数，默认 ${DEFAULT_BASH_TIMEOUT_MS}，上限 ${MAX_BASH_TIMEOUT_MS}`),
  timeout_ms: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('已弃用：请使用 timeout'),
  description: z
    .string()
    .optional()
    .describe('对该命令用途的简短说明（用于权限确认展示）'),
})

type BashRun = {
  stdout: string
  stderr: string
  code: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
}

/**
 * Bash 工具 — 在当前工作目录执行 shell 命令
 *
 * 行为：合并 stdout/stderr，超时中止，输出超限截断，非零退出标 isError。
 * 非只读、非并发安全；实际执行前由 canUseTool 做权限确认（见 #52）。
 */
export const BashTool: Tool<typeof bashInputSchema> = {
  name: 'Bash',
  description:
    '在当前工作目录执行 shell 命令并返回合并的 stdout/stderr。支持超时；非零退出会标记为错误',
  inputSchema: bashInputSchema,

  async call(args) {
    const timeout = clampTimeout(args.timeout ?? args.timeout_ms)
    const run = await runCommand(args.command, timeout)

    const merged = joinOutput(run.stdout, run.stderr)
    const { text, truncated } = truncateOutput(merged)

    if (run.timedOut) {
      return {
        data: appendNote(
          text,
          `[命令超时：超过 ${timeout}ms 已被中止]`,
          truncated,
        ),
        isError: true,
      }
    }

    if (run.code !== 0) {
      const reason =
        run.signal != null
          ? `信号 ${run.signal} 终止`
          : `退出码 ${run.code}`
      return {
        data: appendNote(text, `[命令失败：${reason}]`, truncated),
        isError: true,
      }
    }

    return {
      data: truncated ? appendNote(text, '', truncated) : text || '(无输出)',
    }
  },

  isReadOnly() {
    return false
  },

  isConcurrencySafe() {
    return false
  },

  isEnabled() {
    return true
  },
}

function clampTimeout(ms?: number): number {
  if (!ms || ms <= 0) return DEFAULT_BASH_TIMEOUT_MS
  return Math.min(ms, MAX_BASH_TIMEOUT_MS)
}

function joinOutput(stdout: string, stderr: string): string {
  if (stdout && stderr) return `${stdout}\n${stderr}`
  return stdout || stderr
}

function truncateOutput(output: string): { text: string; truncated: boolean } {
  if (output.length <= MAX_BASH_OUTPUT_CHARS) {
    return { text: output, truncated: false }
  }
  const head = output.slice(0, MAX_BASH_OUTPUT_CHARS)
  return { text: head, truncated: true }
}

function appendNote(text: string, note: string, truncated: boolean): string {
  const parts: string[] = []
  if (text) parts.push(text)
  if (truncated) {
    parts.push(
      `[输出已截断：仅保留前 ${MAX_BASH_OUTPUT_CHARS} 字符]`,
    )
  }
  if (note) parts.push(note)
  return parts.join('\n')
}

function runCommand(command: string, timeoutMs: number): Promise<BashRun> {
  return new Promise(resolve => {
    const isWin = process.platform === 'win32'
    const shell = isWin
      ? process.env.ComSpec || 'cmd.exe'
      : process.env.SHELL || '/bin/bash'
    const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command]

    const child = spawn(shell, shellArgs, {
      cwd: process.cwd(),
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const cap = MAX_BASH_OUTPUT_CHARS + 1_000
    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < cap) stdout += chunk.toString('utf-8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < cap) stderr += chunk.toString('utf-8')
    })

    const timer = setTimeout(() => {
      if (settled) return
      timedOut = true
      settled = true
      killTree(child)
      resolve({ stdout, stderr, code: null, signal: 'SIGKILL', timedOut })
    }, timeoutMs)

    const finish = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code, signal, timedOut })
    }

    child.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        stdout,
        stderr: stderr + `\n${(err as Error).message}`,
        code: null,
        signal: null,
        timedOut,
      })
    })

    child.on('close', (code, signal) => finish(code, signal))
  })
}
