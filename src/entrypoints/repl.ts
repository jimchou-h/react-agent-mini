import type { QueryEngine } from '../QueryEngine.js'
import { consumeQueryStream } from './consumeQueryStream.js'

/** 空行（仅空白）不发起 query */
export function isSkippableReplLine(line: string): boolean {
  return line.trim().length === 0
}

export type ReplSessionDeps = {
  engine: QueryEngine
  /** 用户输入行流（测试可注入；生产由 readline 提供） */
  lines: AsyncIterable<string>
  consume?: typeof consumeQueryStream
  onAfterTurn?: () => void
}

/**
 * REPL 会话核心循环（无 readline 依赖，便于单测）
 *
 * 空行跳过；每行调用 `engine.runTurn` + consumeQueryStream。
 * Slash 命令由后续 issue 接入。
 */
export async function runReplSession(deps: ReplSessionDeps): Promise<void> {
  const consume = deps.consume ?? consumeQueryStream

  for await (const line of deps.lines) {
    if (isSkippableReplLine(line)) {
      deps.onAfterTurn?.()
      continue
    }

    const trimmed = line.trim()
    try {
      await consume(deps.engine.runTurn(trimmed))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`错误: ${msg}`)
    }
    deps.onAfterTurn?.()
  }
}

/**
 * 绑定 node:readline 的 REPL 入口
 */
export async function runRepl(engine: QueryEngine): Promise<void> {
  const readline = await import('node:readline/promises')
  const { stdin: input, stdout: output } = await import('node:process')
  const rl = readline.createInterface({ input, output, prompt: '> ' })

  async function* readLines(): AsyncGenerator<string> {
    rl.prompt()
    for await (const line of rl) {
      yield line
      rl.prompt()
    }
  }

  try {
    await runReplSession({ engine, lines: readLines() })
  } finally {
    rl.close()
  }
}
