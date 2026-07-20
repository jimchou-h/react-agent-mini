import { findToolByName, autoAllowCanUseTool } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import type { ToolUseBlock } from '../../types/message.js'
import type { AssistantMessage, UserMessage } from '../../types/message.js'
import { createToolResultMessage } from '../../utils/messages.js'
import { trace } from '../../utils/trace.js'

/**
 * 单工具执行完成后的更新包
 *
 * 对齐 claude-code toolExecution 的 MessageUpdate 精简版，仅含 tool_result 消息。
 */
export type ToolExecutionUpdate = {
  /** 包装为 user 角色的 tool_result 消息，待 yield 给 query 循环 */
  message: UserMessage
}

function isErrorResult(message: UserMessage): boolean {
  return message.content.some(
    b => b.type === 'tool_result' && b.is_error === true,
  )
}

/**
 * 执行单个 tool_use 块 — 对齐 claude-code runToolUse
 *
 * 完整流水线：
 * 1. findToolByName 查找工具定义
 * 2. inputSchema.safeParse 校验模型传入的 JSON
 * 3. canUseTool 权限检查（缺省 auto-allow）
 * 4. tool.call() 执行业务逻辑
 * 5. 将结果或错误包装为 createToolResultMessage
 *
 * @param block - 模型发起的 tool_use 块
 * @param _parentMessage - 父级 assistant 消息（claude-code 用于钩子，v0 未用）
 * @param context - 工具执行上下文
 */
export async function runToolUse(
  block: ToolUseBlock,
  _parentMessage: AssistantMessage,
  context: ToolUseContext,
): Promise<ToolExecutionUpdate> {
  trace('tool.start', { name: block.name, id: block.id })

  const finish = (update: ToolExecutionUpdate): ToolExecutionUpdate => {
    trace('tool.end', {
      name: block.name,
      id: block.id,
      ok: !isErrorResult(update.message),
    })
    return update
  }

  const tool = findToolByName(context.tools, block.name)
  if (!tool || !tool.isEnabled()) {
    return finish({
      message: createToolResultMessage(
        block.id,
        `未知工具: ${block.name}`,
        true,
      ),
    })
  }

  const parsed = tool.inputSchema.safeParse(block.input)
  if (!parsed.success) {
    return finish({
      message: createToolResultMessage(
        block.id,
        `工具参数无效: ${parsed.error.message}`,
        true,
      ),
    })
  }

  const checkPermission = context.canUseTool ?? autoAllowCanUseTool
  const permission = await checkPermission(tool, parsed.data, context)
  if (permission.behavior === 'deny') {
    return finish({
      message: createToolResultMessage(
        block.id,
        permission.message,
        true,
      ),
    })
  }

  try {
    const result = await tool.call(parsed.data, context)
    const text =
      typeof result.data === 'string'
        ? result.data
        : JSON.stringify(result.data)
    return finish({
      message: createToolResultMessage(block.id, text, false),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return finish({
      message: createToolResultMessage(block.id, msg, true),
    })
  }
}
