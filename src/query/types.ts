import type { QueryDeps } from './deps.js'
import type { ToolUseContext, Tools } from '../Tool.js'
import type { Message } from '../types/message.js'

/**
 * query() 正常结束或异常终止的原因
 *
 * 生成器 return 值类型，CLI / QueryEngine 据此决定退出码与后续逻辑。
 */
export type Terminal =
  /** 模型返回纯文本、无 tool_use，任务完成 */
  | { reason: 'completed' }
  /** 工具调用轮次超过 maxTurns 上限 */
  | { reason: 'max_turns'; turnCount: number }

/**
 * query() 的入参
 *
 * 一次用户请求对应一次 query() 调用；循环在内部完成多轮 model ↔ tool。
 */
export type QueryParams = {
  /** 初始对话历史（通常仅含一条 user 消息） */
  messages: Message[]
  /** 可用工具列表（与 toolUseContext.tools 一致，便于 callModel 出站 schema） */
  tools: Tools
  /** 工具执行上下文 */
  toolUseContext: ToolUseContext
  /** 最大工具轮次，默认 20；防止无限 tool 循环 */
  maxTurns?: number
  /** 可注入的依赖（测试用 mock callModel）；缺省走 productionDeps() */
  deps?: QueryDeps
}

/**
 * callModel（模型 Provider）的入参
 *
 * 由 query 循环每轮调用，传入当前 messages 与 tools 定义。
 */
export type CallModelParams = {
  /** 当前轮应发送给模型的完整消息历史 */
  messages: Message[]
  /** 工具定义列表，Provider 转为 API tools schema */
  tools: Tools
  /** 可选中止信号，用于用户取消（v0 未接线） */
  signal?: AbortSignal
}

/**
 * 模型调用函数签名
 *
 * 异步生成器：yield 流式 text_delta 或完整 assistant 消息。
 * 对齐 claude-code 的 queryModelWithStreaming 消费方式。
 */
export type CallModel = (
  params: CallModelParams,
) => AsyncGenerator<
  import('../types/message.js').StreamEvent | import('../types/message.js').AssistantMessage
>

/**
 * query 循环内部可变状态
 *
 * 每轮 while 迭代开始时解构；continue 时整体替换（对齐 claude-code State 模式）。
 */
export type QueryState = {
  /** 累积的对话消息，每轮 tool 执行后增长 */
  messages: Message[]
  /** 当前轮次计数，从 1 开始；每完成一轮 tool 后 +1 */
  turnCount: number
}
