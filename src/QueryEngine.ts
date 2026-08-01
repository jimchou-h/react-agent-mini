/**
 * L1 会话层 QueryEngine
 *
 * 管多轮用户输入之间的 messages 累积；每轮 `runTurn` 调一次 `query()`。
 * REPL 长期持有一个实例；MCP slash 可通过 injectBefore 注入材料/模板。
 */

import { query } from './query.js'
import type { QueryDeps } from './query/deps.js'
import type { Terminal } from './query/types.js'
import type { ToolUseContext, Tools } from './Tool.js'
import type { Message, QueryYield, UserMessage } from './types/message.js'
import {
  compactConversation,
  type SummarizeFn,
} from './services/compact/autoCompact.js'
import {
  estimateContextUsage,
  type ContextUsageEstimate,
  type TokenUsage,
} from './services/compact/contextUsage.js'
import { createUserMessage } from './utils/messages.js'

export type QueryEngineParams = {
  /** 本会话可用工具（含 MCP） */
  tools: Tools
  toolUseContext: ToolUseContext
  /** 覆盖 productionDeps（测试 / mock） */
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
  #lastUsage: TokenUsage | null = null

  constructor(params: QueryEngineParams) {
    this.#tools = params.tools
    this.#toolUseContext = params.toolUseContext
    this.#deps = params.deps
    this.#maxTurns = params.maxTurns
    this.#systemPrompt = params.systemPrompt
  }

  /** 当前会话消息历史（只读快照视图；写入请用 appendMessages / runTurn） */
  get messages(): Message[] {
    return this.#messages
  }

  /**
   * 追加消息且不调用模型（如 Skill slash 无 args 仅加载）。
   */
  appendMessages(...messages: Message[]): void {
    this.#messages.push(...messages)
  }

  /** 最近一次模型调用的 token usage（若 Provider 未上报则为 null） */
  get lastUsage(): TokenUsage | null {
    return this.#lastUsage
  }

  /** 供 Provider / 测试写入最近一次 usage */
  setLastUsage(usage: TokenUsage | null): void {
    this.#lastUsage = usage
  }

  /**
   * 执行一轮：把本轮消息放进历史，再跑 `query()`，流式产出边走边写入历史。
   *
   * @param userText - 用户自然语言；MCP slash 场景可传空串
   * @param options.injectBefore - 先插入的消息（如 MCP Resource + Prompt），再可选追加 userText。
   *   典型顺序：手册材料 → plan_trip 开场 →（无额外 user 字）→ 调模型
   */
  async *runTurn(
    userText: string,
    options?: { injectBefore?: UserMessage[] },
  ): AsyncGenerator<QueryYield, Terminal> {
    // 1) Host 注入（meta）；2) 用户原文（可省略）
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

  /**
   * 手动 LLM compact：写回 `#messages`。
   * 失败时抛错且不修改会话。
   */
  async compactNow(options: {
    summarize: SummarizeFn
    keepRecentMessages?: number
  }): Promise<{
    summary: string
    before: ContextUsageEstimate
    after: ContextUsageEstimate
  }> {
    const before = estimateContextUsage(this.#messages, {
      usage: this.#lastUsage,
    })
    const { messages, summary } = await compactConversation(this.#messages, {
      summarize: options.summarize,
      keepRecentMessages: options.keepRecentMessages,
      systemPrompt: this.#systemPrompt,
    })
    this.#messages = messages
    this.#lastUsage = null
    const after = estimateContextUsage(this.#messages, { usage: null })
    return { summary, before, after }
  }

  /** 清空会话历史 */
  clear(): void {
    this.#messages = []
    this.#lastUsage = null
  }
}
