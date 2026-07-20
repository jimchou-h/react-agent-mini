import type { ToolUseContext } from '../../Tool.js'
import type { AssistantMessage, ToolUseBlock, UserMessage } from '../../types/message.js'
import { runToolUse } from './execution.js'

/**
 * 工具编排层单次 yield 的更新
 *
 * message 存在时表示一个 tool_result 已就绪，query 循环应 yield 并追加到历史。
 */
export type ToolOrchestrationUpdate = {
  message?: UserMessage
}

/**
 * 串行执行同一轮模型响应中的所有 tool_use — 对齐 claude-code runTools
 *
 * v0 不实现 partitionToolCalls 并发分区；Echo/Read 等只读工具在 issue 后续可优化为并发。
 *
 * @param toolUseBlocks - 本轮 assistant 中的全部 tool_use
 * @param parentMessage - 包含这些 tool_use 的 assistant 消息
 * @param context - 工具执行上下文
 * @yields 每个工具执行完成后的 tool_result user 消息
 */
export async function* runTools(
  toolUseBlocks: ToolUseBlock[],
  parentMessage: AssistantMessage,
  context: ToolUseContext,
): AsyncGenerator<ToolOrchestrationUpdate, void> {
  for (const block of toolUseBlocks) {
    if (context.abortController?.signal.aborted) {
      break
    }
    const { message } = await runToolUse(block, parentMessage, context)
    yield { message }
  }
}
