/**
 * LLM autocompact：侧路摘要 + compact boundary，写回会话内存。
 *
 * 与确定性 microcompact（出站-only）不同：成功后会替换 QueryEngine.messages。
 */

import type { CallModel } from '../../query/types.js'
import type { Message, UserMessage } from '../../types/message.js'
import { createUserMessage } from '../../utils/messages.js'
import { trace } from '../../utils/trace.js'

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
