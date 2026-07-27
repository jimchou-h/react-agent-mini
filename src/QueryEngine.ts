import { query } from './query.js'
import type { QueryDeps } from './query/deps.js'
import type { Terminal } from './query/types.js'
import type { ToolUseContext, Tools } from './Tool.js'
import type { Message, QueryYield, UserMessage } from './types/message.js'
import { createUserMessage } from './utils/messages.js'

export type QueryEngineParams = {
  tools: Tools
  toolUseContext: ToolUseContext
  deps?: Partial<QueryDeps>
  maxTurns?: number
  systemPrompt?: string
}

/**
 * L1 会话层 — 对齐 claude-code QueryEngine 的精简子集
 *
 * 管理多轮用户输入间的 `messages` 累积；每轮 `runTurn` 调用一次 `query()`。
 * REPL 持有一个实例；headless 可不使用。
 */
export class QueryEngine {
  readonly #tools: Tools
  readonly #toolUseContext: ToolUseContext
  readonly #deps: Partial<QueryDeps> | undefined
  readonly #maxTurns: number | undefined
  readonly #systemPrompt: string | undefined
  #messages: Message[] = []

  constructor(params: QueryEngineParams) {
    this.#tools = params.tools
    this.#toolUseContext = params.toolUseContext
    this.#deps = params.deps
    this.#maxTurns = params.maxTurns
    this.#systemPrompt = params.systemPrompt
  }

  /** 当前会话消息历史（只读快照视图，勿外部 mutate） */
  get messages(): Message[] {
    return this.#messages
  }

  /**
   * 执行一轮用户输入：追加 user → query → 将产出的消息合并回历史
   *
   * @param userText - 用户自然语言；MCP slash 等场景可为空字符串
   * @param options.injectBefore - 在当前 turn 开头注入的 meta 消息（如 MCP prompt）
   */
  async *runTurn(
    userText: string,
    options?: { injectBefore?: UserMessage[] },
  ): AsyncGenerator<QueryYield, Terminal> {
    if (options?.injectBefore?.length) {
      this.#messages.push(...options.injectBefore)
    }
    if (userText.trim().length > 0) {
      this.#messages.push(createUserMessage(userText))
    } else if (!options?.injectBefore?.length) {
      throw new Error('runTurn 需要 userText 或 injectBefore')
    }

    // 每轮独立 AbortController：用户拒绝写操作只结束本轮，不影响后续 REPL 输入
    const abortController = new AbortController()
    const toolUseContext: ToolUseContext = {
      ...this.#toolUseContext,
      abortController,
    }

    const gen = query({
      messages: this.#messages,
      tools: this.#tools,
      toolUseContext,
      maxTurns: this.#maxTurns,
      deps: this.#deps,
      systemPrompt: this.#systemPrompt,
    })

    while (true) {
      const { value, done } = await gen.next()
      if (done) {
        return value
      }
      if (value.type === 'assistant' || value.type === 'user') {
        this.#messages.push(value)
      }
      yield value
    }
  }

  /** 清空会话历史 */
  clear(): void {
    this.#messages = []
  }
}
