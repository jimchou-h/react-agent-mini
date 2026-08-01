/**
 * 工具编排：同一轮里多个 tool_use 按顺序串行执行
 *
 * 每个工具跑完就 yield 一条 tool_result（以及可选的 prependMessages，如 Skill 正文）。
 * 权限 abort 后对剩余 tool_use 合成错误 tool_result，保持配对完整。
 */

import type { ToolUseContext } from '../../Tool.js'
import type { AssistantMessage, ToolUseBlock, UserMessage } from '../../types/message.js'
import { createToolResultMessage } from '../../utils/messages.js'
import { runToolUse } from './execution.js'

/**
 * abort 后跳过未执行工具时的合成 tool_result 文案（英文，稳定可断言）
 */
export const SKIPPED_TOOL_RESULT_MESSAGE =
  'Skipped because a previous tool use was rejected or the turn was aborted.'

/**
 * 工具编排层单次 yield 的更新
 *
 * message 存在时表示一个 tool_result 已就绪，query 循环应 yield 并追加到历史。
 */
export type ToolOrchestrationUpdate = {
  message?: UserMessage
  prependMessages?: UserMessage[]
}

/**
 * 串行执行同一轮模型响应中的所有 tool_use — 对齐 claude-code runTools
 *
 * v0 不实现 partitionToolCalls 并发分区；Echo/Read 等只读工具在 issue 后续可优化为并发。
 *
 * @param toolUseBlocks - 本轮 assistant 中的全部 tool_use
 * @param parentMessage - 包含这些 tool_use 的 assistant 消息
 * @param context - 工具执行上下文
 * @yields 每个工具执行完成后的 tool_result user 消息（含 abort 后的合成 skipped）
 */
export async function* runTools(
  toolUseBlocks: ToolUseBlock[],
  parentMessage: AssistantMessage,
  context: ToolUseContext,
): AsyncGenerator<ToolOrchestrationUpdate, void> {
  for (const block of toolUseBlocks) {
    // abort 后不再 call/hooks，但仍补齐 tool_result，避免孤儿 tool_use
    if (context.abortController?.signal.aborted) {
      yield {
        message: createToolResultMessage(
          block.id,
          SKIPPED_TOOL_RESULT_MESSAGE,
          true,
        ),
      }
      continue
    }

    const update = await runToolUse(block, parentMessage, context)
    // Skill 正文等须先于 tool_result，模型才能在「工具返回」前看到注入材料
    if (update.prependMessages) {
      for (const message of update.prependMessages) {
        yield { message }
      }
    }
    yield { message: update.message }
  }
}
