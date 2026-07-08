/**
 * @file 消息与流式事件类型
 *
 * 采用 Anthropic API 的 content 块形态（精简子集），与 claude-code-best 内部表示一致。
 * query 循环、工具层、Provider 适配层都围绕这些类型流转，便于后续接入真实 DeepSeek。
 */

/** 文本内容块 — 用户输入或模型最终回复中的纯文本 */
export type TextBlock = {
  /** 固定判别字段 */
  type: 'text'
  /** 文本正文 */
  text: string
}

/**
 * 工具调用块 — 模型在 assistant 消息中发起的一次 tool_use
 *
 * 每个块有唯一 id，后续 tool_result 通过 tool_use_id 与之配对。
 */
export type ToolUseBlock = {
  type: 'tool_use'
  /** 本次 tool_use 的唯一 ID（由模型或 mock 生成） */
  id: string
  /** 工具名称，对应 Tool.name（如 Echo、Read） */
  name: string
  /** 工具入参 JSON，由 Tool.inputSchema 校验 */
  input: Record<string, unknown>
}

/**
 * 工具结果块 — 工具执行完毕后，作为 user 消息回传给模型
 *
 * API 要求每个 tool_use 必须有对应的 tool_result，否则下一轮请求会失败。
 */
export type ToolResultBlock = {
  type: 'tool_result'
  /** 对应的 tool_use.id */
  tool_use_id: string
  /** 工具返回的文本（成功或错误说明） */
  content: string
  /** 为 true 时表示工具执行失败，模型应据此调整策略 */
  is_error?: boolean
}

/** 单条消息内可出现的所有内容块联合类型 */
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

/**
 * 用户侧消息
 *
 * 既可以是用户自然语言输入（text 块），也可以是工具结果（tool_result 块）。
 */
export type UserMessage = {
  type: 'user'
  content: ContentBlock[]
}

/**
 * 助手侧消息
 *
 * 可含 text（最终回答）或 tool_use（请求调用工具）。
 */
export type AssistantMessage = {
  type: 'assistant'
  content: ContentBlock[]
}

/** 对话历史中的单条消息（用户或助手） */
export type Message = UserMessage | AssistantMessage

/**
 * 流式事件 — 模型流式输出过程中的增量文本
 *
 * CLI 收到后立即打印，无需等待整段 assistant 消息结束。
 */
export type StreamEvent = {
  type: 'text_delta'
  /** 本帧新增的文本片段 */
  text: string
}

/** query() 生成器 yield 的联合类型：流式片段或完整消息 */
export type QueryYield = StreamEvent | Message
