import type { Message, ToolResultBlock } from '../../types/message.js'
import { trace } from '../../utils/trace.js'

/** 追加在被截断 tool_result 末尾的提示 */
export const TRUNCATION_NOTE = '\n…[tool_result 已截断（compact）]'

/** compact 策略配置；缺省值见模块内 DEFAULT_* 常量 */
export type CompactOptions = {
  /** 单条 tool_result.content 字符上限，超出则截断 */
  maxToolResultChars?: number
  /** 出站消息条数上限，超出则丢弃最早轮次保留尾部 */
  maxMessages?: number
}

const DEFAULT_MAX_TOOL_RESULT_CHARS = 4000
const DEFAULT_MAX_MESSAGES = 40

/**
 * 出站消息裁剪（确定性，无 LLM）
 *
 * 两级策略：1) 截断超长 `tool_result.content`；2) 条数超限时丢弃最早轮次，
 * 裁剪边界对齐 user 纯文本消息，保证 tool_use/tool_result 配对完整。
 * 不修改传入的 messages（出站-only）；无任何变更时原样返回同一数组。
 */
export function compactMessages(
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  const maxToolResultChars =
    options?.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES

  const tail = retainTail(messages, maxMessages)
  const droppedMessages = messages.length - tail.length

  let truncatedBlocks = 0
  const out = tail.map(message => {
    if (message.type !== 'user') return message

    let changed = false
    const content = message.content.map(block => {
      if (
        block.type === 'tool_result' &&
        block.content.length > maxToolResultChars
      ) {
        changed = true
        truncatedBlocks++
        return truncateToolResult(block, maxToolResultChars)
      }
      return block
    })

    return changed ? { ...message, content } : message
  })

  if (truncatedBlocks === 0 && droppedMessages === 0) {
    return messages
  }

  trace('compact.run', {
    before: messages.length,
    after: out.length,
    droppedMessages,
    truncatedBlocks,
  })
  return out
}

/** user 纯文本消息 — 安全的裁剪起点（不会留下孤儿 tool_result） */
function isUserTextMessage(message: Message): boolean {
  return (
    message.type === 'user' && message.content.every(b => b.type === 'text')
  )
}

/**
 * 条数超限时保留尾部完整轮次
 *
 * 从 `length - maxMessages` 起向后找最近的 user 纯文本消息作为边界；
 * 找不到时整体不裁（宁可超限也不裁断配对）。
 */
function retainTail(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages

  let start = messages.length - maxMessages
  while (start < messages.length && !isUserTextMessage(messages[start])) {
    start++
  }
  if (start >= messages.length) return messages

  return messages.slice(start)
}

function truncateToolResult(
  block: ToolResultBlock,
  maxChars: number,
): ToolResultBlock {
  return {
    ...block,
    content: block.content.slice(0, maxChars) + TRUNCATION_NOTE,
  }
}
