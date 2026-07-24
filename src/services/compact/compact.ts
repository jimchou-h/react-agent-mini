import type { Message, ToolResultBlock } from '../../types/message.js'
import { trace } from '../../utils/trace.js'

/** 追加在被截断 tool_result 末尾的提示 */
export const TRUNCATION_NOTE = '\n…[tool_result 已截断（compact）]'

/** compact 策略配置；缺省值见 resolveCompactOptions */
export type CompactOptions = {
  /** 单条 tool_result.content 字符上限，超出则截断 */
  maxToolResultChars?: number
}

const DEFAULT_MAX_TOOL_RESULT_CHARS = 4000

/**
 * 出站消息裁剪（确定性，无 LLM）
 *
 * 仅生成发送副本：截断超长 `tool_result.content`。
 * 不修改传入的 messages（出站-only）；无任何变更时原样返回同一数组。
 */
export function compactMessages(
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  const maxToolResultChars =
    options?.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS

  let truncatedBlocks = 0
  const out = messages.map(message => {
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

  if (truncatedBlocks === 0) {
    return messages
  }

  trace('compact.run', {
    messages: messages.length,
    truncatedBlocks,
  })
  return out
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
