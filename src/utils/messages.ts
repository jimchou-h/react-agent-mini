import type {
  AssistantMessage,
  ContentBlock,
  Message,
  ToolResultBlock,
  UserMessage,
} from '../types/message.js'

/**
 * 从纯文本构造 user 消息
 *
 * 用于 CLI 入口将用户问题包装为对话历史的第一条消息。
 *
 * @param text - 用户输入的自然语言
 */
export function createUserMessage(text: string): UserMessage {
  return {
    type: 'user',
    content: [{ type: 'text', text }],
  }
}

/**
 * 构造 assistant 消息
 *
 * @param content - 内容块数组（text 和/或 tool_use）
 */
export function createAssistantMessage(
  content: ContentBlock[],
): AssistantMessage {
  return { type: 'assistant', content }
}

/**
 * 构造包含单个 tool_result 的 user 消息
 *
 * 工具执行完毕后，必须以 user 角色将结果回传给模型（Anthropic 协议要求）。
 *
 * @param toolUseId - 对应的 tool_use.id
 * @param content - 工具输出或错误信息（字符串）
 * @param isError - 是否为错误结果
 */
export function createToolResultMessage(
  toolUseId: string,
  content: string,
  isError = false,
): UserMessage {
  const block: ToolResultBlock = {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content,
    ...(isError ? { is_error: true } : {}),
  }
  return { type: 'user', content: [block] }
}

/**
 * 从 assistant 消息中提取所有 tool_use 块
 *
 * query 循环用此判断 needsFollowUp，并收集待执行的 tool_use 列表。
 *
 * @param message - 模型返回的 assistant 消息
 */
export function extractToolUseBlocks(message: AssistantMessage) {
  return message.content.filter(
    (b): b is Extract<ContentBlock, { type: 'tool_use' }> =>
      b.type === 'tool_use',
  )
}

/**
 * 将一轮对话（assistant + tool results）追加到历史
 *
 * 下一轮 callModel 会收到完整上下文：...历史, assistant(tool_use), user(tool_result)
 *
 * @param history - 本轮之前的消息列表
 * @param assistant - 本轮模型响应（含 tool_use）
 * @param toolResults - 本轮各工具的 tool_result user 消息
 */
export function appendTurnMessages(
  history: Message[],
  assistant: AssistantMessage,
  toolResults: UserMessage[],
): Message[] {
  return [...history, assistant, ...toolResults]
}
