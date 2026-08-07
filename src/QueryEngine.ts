/**
 * L1 会话层 QueryEngine
 *
 * 管多轮用户输入之间的 messages 累积；每轮 `runTurn` 调一次 `query()`。
 * REPL 长期持有一个实例；MCP slash 可通过 injectBefore 注入材料/模板。
 * 可选 memoryRefresh：runTurn 前按 mtime 刷新 Memory 并重建 systemPrompt。
 */

import { query } from './query.js'
import { productionDeps, type QueryDeps } from './query/deps.js'
import type { Terminal } from './query/types.js'
import type { ToolUseContext, Tools } from './Tool.js'
import type { Message, QueryYield, UserMessage } from './types/message.js'
import {
  compactConversation,
  type SummarizeFn,
} from './services/compact/autoCompact.js'
import {
  estimateContextUsage,
  formatCompactSuccessFeedback,
  type ContextUsageEstimate,
  type TokenUsage,
} from './services/compact/contextUsage.js'
import {
  refreshMemorySnapshot,
  type MemorySnapshot,
} from './services/memory/load.js'
import type { DiscoveredSkill } from './skills/discover.js'
import { buildSystemPrompt } from './skills/systemPrompt.js'
import { createUserMessage } from './utils/messages.js'

/** 轮次前按 mtime 刷新 Memory 并重建 systemPrompt */
export type MemoryRefreshBinding = {
  cwd: string
  projectContext: string | undefined
  skills: readonly DiscoveredSkill[]
  snapshot: MemorySnapshot
}

export type QueryEngineParams = {
  /** 本会话可用工具（含 MCP） */
  tools: Tools
  toolUseContext: ToolUseContext
  /** 覆盖 productionDeps（测试 / mock） */
  deps?: Partial<QueryDeps>
  maxTurns?: number
  systemPrompt?: string
  /** 启用后每次 runTurn 前按 mtime 刷新 Memory */
  memoryRefresh?: MemoryRefreshBinding
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
  #systemPrompt: string | undefined
  #memoryRefresh: MemoryRefreshBinding | undefined
  #messages: Message[] = []
  #lastUsage: TokenUsage | null = null
  /** 当前 runTurn 的 AbortController；无进行中 turn 时为 undefined */
  #currentAbort: AbortController | undefined
  /** 本轮 autocompact 成功后的用户可见反馈；take 一次后清空 */
  #pendingCompactFeedback: string | null = null

  constructor(params: QueryEngineParams) {
    this.#tools = params.tools
    this.#toolUseContext = params.toolUseContext
    this.#deps = params.deps
    this.#maxTurns = params.maxTurns
    this.#systemPrompt = params.systemPrompt
    this.#memoryRefresh = params.memoryRefresh
  }

  /** 当前会话消息历史（只读快照视图；写入请用 appendMessages / runTurn） */
  get messages(): Message[] {
    return this.#messages
  }

  /** 是否有尚未结束的 runTurn */
  get isTurnInProgress(): boolean {
    return this.#currentAbort !== undefined
  }

  /**
   * 中止当前轮（interrupt / 宿主取消）。
   * @returns 是否实际触发了 abort（无进行中 turn 时为 false）
   */
  abortCurrentTurn(reason: unknown = 'interrupt'): boolean {
    const ac = this.#currentAbort
    if (!ac || ac.signal.aborted) return false
    ac.abort(reason)
    return true
  }

  /** 当前出站 system prompt（含可能已刷新的 Memory） */
  get systemPrompt(): string | undefined {
    return this.#systemPrompt
  }

  /** Memory 路径与最近快照（未启用 memoryRefresh 则为 undefined） */
  get memorySnapshot(): MemorySnapshot | undefined {
    return this.#memoryRefresh?.snapshot
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

  /**
   * 取出并清空本轮 autocompact 成功反馈（无则 null）。
   * REPL 在 printContextUsage 前调用，与手动 `/compact` 文案一致。
   */
  takeCompactFeedback(): string | null {
    const text = this.#pendingCompactFeedback
    this.#pendingCompactFeedback = null
    return text
  }

  /** 供 Provider / 测试写入最近一次 usage */
  setLastUsage(usage: TokenUsage | null): void {
    this.#lastUsage = usage
  }

  /** 按 mtime 刷新 Memory；未绑定则 no-op */
  async refreshMemoryIfNeeded(): Promise<boolean> {
    if (!this.#memoryRefresh) return false
    const { snapshot, changed } = await refreshMemorySnapshot(
      this.#memoryRefresh.cwd,
      this.#memoryRefresh.snapshot,
    )
    if (!changed) return false
    this.#memoryRefresh = { ...this.#memoryRefresh, snapshot }
    this.#systemPrompt = buildSystemPrompt(
      this.#memoryRefresh.projectContext,
      this.#memoryRefresh.skills,
      snapshot.content,
      this.#memoryRefresh.cwd,
    )
    return true
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
    await this.refreshMemoryIfNeeded()

    // 1) Host 注入（meta）；2) 用户原文（可省略）
    if (options?.injectBefore?.length) {
      this.#messages.push(...options.injectBefore)
    }
    if (userText.trim().length > 0) {
      this.#messages.push(createUserMessage(userText))
    } else if (!options?.injectBefore?.length) {
      throw new Error('runTurn 需要 userText 或 injectBefore')
    }

    // 每轮独立 AbortController：用户拒绝写操作 / interrupt 只结束本轮
    const abortController = new AbortController()
    this.#currentAbort = abortController
    const toolUseContext: ToolUseContext = {
      ...this.#toolUseContext,
      abortController,
    }

    try {
      const baseAutocompact =
        this.#deps?.autocompact ??
        ((messages, options) =>
          productionDeps().autocompact(messages, options))
      const deps: Partial<QueryDeps> = {
        ...this.#deps,
        autocompact: async (messages, options) => {
          const result = await Promise.resolve(
            baseAutocompact(messages, options),
          )
          if (result.compacted && result.before && result.after) {
            this.#pendingCompactFeedback = formatCompactSuccessFeedback(
              result.before,
              result.after,
            )
          }
          return result
        },
      }
      const gen = query({
        messages: this.#messages,
        tools: this.#tools,
        toolUseContext,
        maxTurns: this.#maxTurns,
        deps,
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
    } finally {
      if (this.#currentAbort === abortController) {
        this.#currentAbort = undefined
      }
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
