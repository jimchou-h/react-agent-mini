/**
 * LLM autocompact：侧路摘要 + compact boundary，写回会话内存。
 *
 * 与确定性 microcompact（出站-only）不同：成功后会替换 QueryEngine.messages。
 */

import type { CallModel } from '../../query/types.js'
import type { Message, UserMessage } from '../../types/message.js'
import { createUserMessage } from '../../utils/messages.js'
import { trace } from '../../utils/trace.js'
import {
  estimateContextUsage,
  type ContextUsageEstimate,
  type TokenUsage,
} from './contextUsage.js'

/** 默认占用百分比阈值：达到后尝试 autocompact */
export const DEFAULT_AUTOCOMPACT_PERCENT = 80

/** 连续失败多少次后熔断自动摘要 */
export const MAX_AUTOCOMPACT_FAILURES = 3

export type AutoCompactTracking = {
  consecutiveFailures: number
}

export type AutocompactFn = (
  messages: Message[],
  options?: Partial<AutoCompactIfNeededOptions> & {
    summarize?: SummarizeFn
  },
) => Promise<AutoCompactResult> | AutoCompactResult

export type AutoCompactIfNeededOptions = {
  summarize: SummarizeFn
  /** 强制压缩（忽略阈值；仍受 COMPACT=0 约束） */
  force?: boolean
  /** 占用百分比阈值；缺省 80 或 `AUTOCOMPACT_PERCENT` */
  thresholdPercent?: number
  keepRecentMessages?: number
  systemPrompt?: string
  usage?: TokenUsage | null
  /** 覆盖上下文窗口（测试 / 自定义） */
  windowTokens?: number
  /** 熔断计数；成功时清零，失败时 +1 */
  tracking?: AutoCompactTracking
}

export type AutoCompactResult = {
  compacted: boolean
  messages: Message[]
  /** 实质压缩成功时的占用前后（供 REPL 反馈） */
  before?: ContextUsageEstimate
  after?: ContextUsageEstimate
  reason?:
    | 'compact_disabled'
    | 'autocompact_disabled'
    | 'below_threshold'
    | 'circuit_open'
    | 'nothing_to_compact'
    | 'success'
    | 'failed'
}

/** 边界标记正文 — 用于识别 compact 切点 */
export const COMPACT_BOUNDARY_TEXT = '[compact boundary]'

/** 侧路摘要函数：无工具，返回纯文本摘要 */
export type SummarizeFn = (
  messages: Message[],
  systemPrompt?: string,
) => Promise<string>

export type CompactConversationOptions = {
  summarize: SummarizeFn
  /** 压缩后保留的尾部消息条数；缺省 4 */
  keepRecentMessages?: number
  systemPrompt?: string
}

export type CompactConversationResult = {
  messages: Message[]
  summary: string
}

const DEFAULT_KEEP_RECENT = 4

/** 是否为 compact boundary meta 消息 */
export function isCompactBoundaryMessage(message: Message): boolean {
  if (message.type !== 'user') return false
  if (!message.meta) return false
  return message.content.some(
    b => b.type === 'text' && b.text.includes(COMPACT_BOUNDARY_TEXT),
  )
}

/** 取最后一个 boundary 之后的消息（含摘要与尾部）；无 boundary 则原样返回 */
export function getMessagesAfterCompactBoundary(messages: Message[]): Message[] {
  let last = -1
  for (let i = 0; i < messages.length; i++) {
    if (isCompactBoundaryMessage(messages[i]!)) last = i
  }
  if (last < 0) return messages
  return messages.slice(last + 1)
}

function createBoundaryMessage(): UserMessage {
  return {
    type: 'user',
    meta: true,
    content: [{ type: 'text', text: COMPACT_BOUNDARY_TEXT }],
  }
}

function createSummaryMessage(summary: string): UserMessage {
  const text = `Conversation summary (compacted):\n${summary}`
  return {
    ...createUserMessage(text),
    meta: true,
  }
}

/**
 * 将较早历史压成摘要并写回新消息列表。
 * 失败时抛错，调用方不得替换原会话。
 */
export async function compactConversation(
  messages: Message[],
  options: CompactConversationOptions,
): Promise<CompactConversationResult> {
  const keep = options.keepRecentMessages ?? DEFAULT_KEEP_RECENT
  const toSummarize =
    messages.length > keep ? messages.slice(0, -keep) : messages.slice(0, 0)
  const tail = messages.length > keep ? messages.slice(-keep) : [...messages]

  // 没有可压内容时仍强制生成摘要（手动 /compact），用全文
  const source = toSummarize.length > 0 ? toSummarize : messages
  const tailFinal = toSummarize.length > 0 ? tail : []

  const summary = (await options.summarize(source, options.systemPrompt)).trim()
  if (!summary) {
    throw new Error('compact summary is empty')
  }

  const next: Message[] = [
    createBoundaryMessage(),
    createSummaryMessage(summary),
    ...tailFinal,
  ]

  trace('compact.llm', {
    before: messages.length,
    after: next.length,
    kept: tailFinal.length,
  })

  return { messages: next, summary }
}

function isCompactPipelineEnabled(): boolean {
  return process.env.COMPACT !== '0'
}

function isAutocompactEnabled(): boolean {
  return process.env.AUTOCOMPACT !== '0'
}

function resolveAutocompactPercent(override?: number): number {
  if (override != null && override > 0) return override
  const raw = process.env.AUTOCOMPACT_PERCENT
  if (raw != null && /^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n > 0) return Math.min(100, n)
  }
  return DEFAULT_AUTOCOMPACT_PERCENT
}

/**
 * 阈值触发的 LLM 摘要。失败 fail-soft：返回原 messages，不抛错。
 * `COMPACT=0` / `AUTOCOMPACT=0` / 熔断 / 低于阈值 → 不压缩。
 */
export async function autoCompactIfNeeded(
  messages: Message[],
  options: AutoCompactIfNeededOptions,
): Promise<AutoCompactResult> {
  if (!isCompactPipelineEnabled()) {
    return { compacted: false, messages, reason: 'compact_disabled' }
  }
  if (!options.force && !isAutocompactEnabled()) {
    return { compacted: false, messages, reason: 'autocompact_disabled' }
  }

  const tracking = options.tracking
  if (
    !options.force &&
    tracking &&
    tracking.consecutiveFailures >= MAX_AUTOCOMPACT_FAILURES
  ) {
    return { compacted: false, messages, reason: 'circuit_open' }
  }

  const usage = estimateContextUsage(messages, {
    usage: options.usage ?? null,
    windowTokens: options.windowTokens,
  })
  const threshold = resolveAutocompactPercent(options.thresholdPercent)
  if (!options.force && usage.usedPercent < threshold) {
    return { compacted: false, messages, reason: 'below_threshold' }
  }

  // 已只有 boundary+摘要+短尾时再压意义不大
  if (messages.length <= 2) {
    return { compacted: false, messages, reason: 'nothing_to_compact' }
  }

  try {
    const { messages: next } = await compactConversation(messages, {
      summarize: options.summarize,
      keepRecentMessages: options.keepRecentMessages,
      systemPrompt: options.systemPrompt,
    })
    if (tracking) tracking.consecutiveFailures = 0
    const after = estimateContextUsage(next, { usage: null })
    trace('compact.auto', {
      before: messages.length,
      after: next.length,
      percent: usage.usedPercent,
    })
    return {
      compacted: true,
      messages: next,
      before: usage,
      after,
      reason: 'success',
    }
  } catch (err) {
    if (tracking) tracking.consecutiveFailures += 1
    const msg = err instanceof Error ? err.message : String(err)
    trace('compact.auto_fail', { error: msg, failures: tracking?.consecutiveFailures })
    return { compacted: false, messages, reason: 'failed' }
  }
}

/**
 * 用既有 callModel 做无工具侧路摘要（供 `/compact` / autocompact）。
 * mock 模式下 callModel 也会返回文本，足够演示。
 */
export function createSummarizeFromCallModel(callModel: CallModel): SummarizeFn {
  return async (messages, systemPrompt) => {
    const prompt = buildSummarizePrompt(messages)
    const parts: string[] = []
    for await (const event of callModel({
      messages: [createUserMessage(prompt)],
      tools: [],
      systemPrompt:
        systemPrompt ??
        'You summarize conversations for context compaction. Reply with a concise summary only.',
    })) {
      if (event.type === 'text_delta') {
        parts.push(event.text)
      } else if (event.type === 'assistant') {
        for (const block of event.content) {
          if (block.type === 'text') parts.push(block.text)
        }
      }
    }
    return parts.join('').trim()
  }
}

function buildSummarizePrompt(messages: Message[]): string {
  const lines: string[] = [
    'Summarize the following conversation so a coding agent can continue the task. Keep key decisions, file paths, errors, and open questions.',
    '',
  ]
  for (const message of messages) {
    const role = message.type
    const text = message.content
      .map(b => {
        if (b.type === 'text') return b.text
        if (b.type === 'tool_use') return `[tool_use ${b.name}]`
        if (b.type === 'tool_result') {
          const body =
            b.content.length > 500 ? `${b.content.slice(0, 500)}…` : b.content
          return `[tool_result] ${body}`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
    if (text) lines.push(`${role}: ${text}`)
  }
  return lines.join('\n')
}
