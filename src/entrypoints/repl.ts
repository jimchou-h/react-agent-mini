import type { QueryEngine } from '../QueryEngine.js'
import { consumeQueryStream } from './consumeQueryStream.js'

/** 空行（仅空白）不发起 query */
export function isSkippableReplLine(line: string): boolean {
  return line.trim().length === 0
}

export type SlashCommand =
  | { type: 'exit' }
  | { type: 'clear' }
  | { type: 'help' }

const HELP_TEXT = `可用命令:
  /exit, /quit  — 退出 REPL
  /clear        — 清空会话历史
  /help         — 显示本帮助`

/**
 * 解析本地 slash 命令；普通输入或未知 `/xxx` 返回 null（未知不送 slash，也不当模型输入——见 session）
 *
 * 未知 `/foo`：按 AC「slash 输入不作为模型 user」——打印提示，不 runTurn。
 */
export function parseSlashCommand(line: string): SlashCommand | null {
  const trimmed = line.trim()
  if (trimmed === '/exit' || trimmed === '/quit') {
    return { type: 'exit' }
  }
  if (trimmed === '/clear') {
    return { type: 'clear' }
  }
  if (trimmed === '/help') {
    return { type: 'help' }
  }
  return null
}

export function isSlashLine(line: string): boolean {
  return line.trim().startsWith('/')
}

export type ReplSessionDeps = {
  engine: QueryEngine
  lines: AsyncIterable<string>
  consume?: typeof consumeQueryStream
  onAfterTurn?: () => void
  /** 测试可捕获帮助/确认输出 */
  print?: (text: string) => void
}

/**
 * REPL 会话核心循环（无 readline 依赖，便于单测）
 */
export async function runReplSession(deps: ReplSessionDeps): Promise<void> {
  const consume = deps.consume ?? consumeQueryStream
  const print = deps.print ?? ((text: string) => console.log(text))

  for await (const line of deps.lines) {
    if (isSkippableReplLine(line)) {
      deps.onAfterTurn?.()
      continue
    }

    const trimmed = line.trim()
    const slash = parseSlashCommand(trimmed)

    if (slash?.type === 'exit') {
      break
    }
    if (slash?.type === 'clear') {
      deps.engine.clear()
      print('会话已清空')
      deps.onAfterTurn?.()
      continue
    }
    if (slash?.type === 'help') {
      print(HELP_TEXT)
      deps.onAfterTurn?.()
      continue
    }
    if (isSlashLine(trimmed)) {
      print('未知命令。输入 /help 查看可用命令。')
      deps.onAfterTurn?.()
      continue
    }

    try {
      await consume(deps.engine.runTurn(trimmed))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`错误: ${msg}`)
    }
    deps.onAfterTurn?.()
  }
}

type ReadlineInterface = {
  question: (query: string) => Promise<string>
  close: () => void
}

/**
 * 用 rl.question 驱动行迭代，便于与权限确认共用同一 Interface
 */
export async function* linesFromReadlineQuestions(
  rl: ReadlineInterface,
  prompt = '> ',
): AsyncGenerator<string> {
  while (true) {
    try {
      yield await rl.question(prompt)
    } catch {
      break
    }
  }
}

/**
 * 绑定 node:readline 的 REPL 入口
 *
 * @param engine - 会话引擎
 * @param existingRl - 可选：由 CLI 创建并注入 ask 的同一 readline，避免双开冲突
 */
export async function runRepl(
  engine: QueryEngine,
  existingRl?: import('node:readline/promises').Interface,
): Promise<void> {
  if (existingRl) {
    await runReplSession({
      engine,
      lines: linesFromReadlineQuestions(existingRl),
    })
    return
  }

  const readline = await import('node:readline/promises')
  const { stdin: input, stdout: output } = await import('node:process')
  const rl = readline.createInterface({ input, output })

  try {
    await runReplSession({
      engine,
      lines: linesFromReadlineQuestions(rl),
    })
  } finally {
    rl.close()
  }
}
