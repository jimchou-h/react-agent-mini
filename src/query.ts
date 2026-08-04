/**
 * ReAct 主循环：callModel → 有 tool_use 则 runTools → 追加消息 → 重复，
 * 直到无工具调用或达 maxTurns。对外 API 对齐 claude-code 的 query()。
 */

import { productionDeps } from './query/deps.js'
import type { QueryDeps } from './query/deps.js'
import type { QueryParams, QueryState, Terminal } from './query/types.js'
import type {
  AssistantMessage,
  Message,
  QueryYield,
  StreamEvent,
  UserMessage,
} from './types/message.js'
import {
  applyRetainTailIfNeeded,
  applyToolResultBudget,
} from './services/compact/compact.js'
import { loadHooksConfig } from './services/hooks/load.js'
import { runStop } from './services/hooks/run.js'
import type { HooksConfig } from './services/hooks/types.js'
import { runTools } from './services/tools/orchestration.js'
import {
  appendTurnMessages,
  createAssistantMessage,
  createUserMessage,
  extractToolUseBlocks,
} from './utils/messages.js'
import { trace } from './utils/trace.js'

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: string }).name
  return name === 'AbortError' || name === 'APIUserAbortError'
}

function resolveHooksConfig(params: QueryParams): HooksConfig | null {
  const fromCtx = params.toolUseContext.hooksConfig
  if (fromCtx !== undefined) return fromCtx
  return loadHooksConfig()
}

function formatStopFeedback(feedback: string): string {
  return `Stop hook feedback:\n${feedback}`
}

/**
 * ReAct 主入口 — 对齐 claude-code src/query.ts 的 public API
 *
 * 单次用户请求内循环：调用模型 → 若有 tool_use 则执行工具 → 追加消息 → 重复，
 * 直到模型不再请求工具或达到 maxTurns。
 *
 * @param params - 消息历史、工具、上下文、可选 deps 覆盖
 * @yields 流式 text_delta、assistant/user 消息（供 CLI 打印或 UI 渲染）
 * @returns 循环终止原因 Terminal（通过生成器 return 值）
 *
 * @example
 * ```ts
 * for await (const item of query({ messages, tools, toolUseContext })) {
 *   if (item.type === 'text_delta') process.stdout.write(item.text)
 * }
 * const { value: terminal } = await gen.next() // 需手动 next 获取 return
 * ```
 */
export async function* query(
  params: QueryParams,
): AsyncGenerator<QueryYield, Terminal> {
  const deps: QueryDeps = { ...productionDeps(), ...params.deps }
  const maxTurns = params.maxTurns ?? 20

  let state: QueryState = {
    messages: params.messages,
    turnCount: 1,
  }

  return yield* queryLoop(params, state, deps, maxTurns)
}

/**
 * 核心 ReAct 循环体 — 对应 claude-code 内部的 queryLoop()
 *
 * 每轮迭代步骤：
 * 1. 出站 compact 管道 → callModel（会话内存不变）
 * 2. 若响应无 tool_use → Stop；prevent 结束 / blocking 再进一轮 / 否则 completed
 * 3. runTools 串行执行 → 得到 tool_result
 * 4. messages 追加 assistant + tool_results，turnCount++，continue
 */
async function* queryLoop(
  params: QueryParams,
  initialState: QueryState,
  deps: QueryDeps,
  maxTurns: number,
): AsyncGenerator<QueryYield, Terminal> {
  let state = initialState
  /** 因 Stop blocking 再进轮时为 true，传给后续 Stop */
  let stopHookActive = false

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { messages, turnCount } = state
    trace('query.turn_start', { turn: turnCount })

    /** 本轮模型产生的 assistant 消息（通常一条） */
    const assistantMessages: AssistantMessage[] = []
    /** 本轮从 assistant 中解析出的待执行 tool_use 列表 */
    const toolUseBlocks: Array<{
      type: 'tool_use'
      id: string
      name: string
      input: Record<string, unknown>
    }> = []

    /**
     * 是否需要在工具执行后继续下一轮模型调用
     *
     * 判定依据：流式/完整响应中是否出现 tool_use 块。
     * 不依赖 API 的 stop_reason（claude-code 注释：stop_reason === 'tool_use' 不可靠）
     */
    let needsFollowUp = false

    // —— 阶段 0：LLM autocompact（可写回会话；失败 keep 原 messages）——
    const autoResult = await Promise.resolve(
      deps.autocompact(messages, {
        systemPrompt: params.systemPrompt,
      }),
    )
    let sessionMessages = messages
    if (autoResult.compacted) {
      sessionMessages = autoResult.messages
      // 写回同一数组引用，便于 QueryEngine.#messages 同步
      params.messages.length = 0
      params.messages.push(...sessionMessages)
      sessionMessages = params.messages
      state = { ...state, messages: sessionMessages }
    }

    // —— 阶段 1：出站 compact 管道（对齐 claude-code；出站-only）——
    // applyToolResultBudget → deps.microcompact →（重估后）retainTail
    const compactOpts = params.compact
    let outbound = applyToolResultBudget(sessionMessages, compactOpts)
    outbound = await Promise.resolve(
      deps.microcompact(outbound, compactOpts),
    )
    outbound = applyRetainTailIfNeeded(outbound, compactOpts)

    const abortSignal = params.toolUseContext.abortController?.signal

    try {
      for await (const chunk of deps.callModel({
        messages: outbound,
        tools: params.tools,
        systemPrompt: params.systemPrompt,
        signal: abortSignal,
      })) {
        if (abortSignal?.aborted) {
          trace('query.turn_end', { reason: 'aborted', turn: turnCount })
          return { reason: 'aborted' }
        }

        if (chunk.type === 'text_delta') {
          yield chunk satisfies StreamEvent
          continue
        }

        if (chunk.type === 'assistant') {
          assistantMessages.push(chunk)
          yield chunk

          const blocks = extractToolUseBlocks(chunk)
          if (blocks.length > 0) {
            needsFollowUp = true
            toolUseBlocks.push(...blocks)
          }
        }
      }
    } catch (err) {
      if (abortSignal?.aborted || isAbortError(err)) {
        trace('query.turn_end', { reason: 'aborted', turn: turnCount })
        return { reason: 'aborted' }
      }
      throw err
    }

    if (abortSignal?.aborted) {
      trace('query.turn_end', { reason: 'aborted', turn: turnCount })
      return { reason: 'aborted' }
    }

    // —— 阶段 2：无工具则 Stop / 结束 ——
    if (!needsFollowUp) {
      const depth = params.depth ?? 0
      if (depth === 0) {
        const hooksConfig = resolveHooksConfig(params)
        const stopResult = await runStop(hooksConfig, {
          exec: params.toolUseContext.hookExec,
          stopHookActive,
        })

        if (stopResult.preventContinuation) {
          trace('query.turn_end', {
            reason: 'completed',
            turn: turnCount,
            stop: 'prevented',
          })
          return { reason: 'completed' }
        }

        if (stopResult.blockingFeedback) {
          const nextTurnCount = turnCount + 1
          if (nextTurnCount > maxTurns) {
            trace('query.turn_end', {
              reason: 'max_turns',
              turn: nextTurnCount,
              stop: 'blocking',
            })
            return { reason: 'max_turns', turnCount: nextTurnCount }
          }

          const feedbackMsg = createUserMessage(
            formatStopFeedback(stopResult.blockingFeedback),
          )
          yield feedbackMsg

          const nextMessages = [
            ...sessionMessages,
            ...assistantMessages,
            feedbackMsg,
          ]
          params.messages.length = 0
          params.messages.push(...nextMessages)
          state = {
            messages: params.messages,
            turnCount: nextTurnCount,
          }
          stopHookActive = true
          continue
        }
      }

      trace('query.turn_end', { reason: 'completed', turn: turnCount })
      return { reason: 'completed' }
    }

    stopHookActive = false

    // —— 阶段 3：串行执行工具 ——
    const parentMessage =
      assistantMessages.at(-1) ??
      createAssistantMessage(toolUseBlocks.map(b => ({ ...b })))

    const toolResults: UserMessage[] = []
    for await (const update of runTools(
      toolUseBlocks,
      parentMessage,
      params.toolUseContext,
    )) {
      if (update.message) {
        yield update.message
        toolResults.push(update.message)
      }
    }

    // 用户拒绝权限等：中止本轮，不再回调模型（对齐 claude-code abort）
    if (params.toolUseContext.abortController?.signal.aborted) {
      trace('query.turn_end', { reason: 'aborted', turn: turnCount })
      return { reason: 'aborted' }
    }

    // —— 阶段 4：轮次上限检查 ——
    const nextTurnCount = turnCount + 1
    if (nextTurnCount > maxTurns) {
      trace('query.turn_end', {
        reason: 'max_turns',
        turn: nextTurnCount,
      })
      return { reason: 'max_turns', turnCount: nextTurnCount }
    }

    // —— 阶段 5：追加历史，进入下一轮 ——
    state = {
      messages: appendTurnMessages(sessionMessages, parentMessage, toolResults),
      turnCount: nextTurnCount,
    }
  }
}
