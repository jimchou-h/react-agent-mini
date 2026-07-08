/**
 * @file Mock 模型 Provider（issue #1）
 *
 * 在不连接 DeepSeek 的情况下模拟两轮 ReAct，用于本地开发与 CI 验收。
 * 由 productionDeps() 在 QUERY_MOCK=1 或 CLI --mock 时选用。
 */

import type { CallModelParams } from '../../query/types.js'
import type { AssistantMessage, StreamEvent } from '../../types/message.js'
import { createAssistantMessage } from '../../utils/messages.js'

/**
 * 从对话历史中提取 Echo 工具应回显的文本
 *
 * 解析规则（按优先级）：
 * 1. 匹配「回复 xxx」
 * 2. 匹配「echo xxx」（不区分大小写）
 * 3. 默认 "hello"
 *
 * @param messages - 当前 callModel 收到的完整历史
 */
function extractEchoPayload(messages: CallModelParams['messages']): string {
  const lastUser = [...messages].reverse().find(m => m.type === 'user')
  if (!lastUser) return 'hello'

  const text = lastUser.content
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join(' ')

  const replyMatch = /回复\s+(.+)/i.exec(text)
  if (replyMatch?.[1]) return replyMatch[1].trim()

  const echoMatch = /echo\s+(.+)/i.exec(text)
  if (echoMatch?.[1]) return echoMatch[1].trim()

  return 'hello'
}

/**
 * 判断历史中是否已存在 tool_result
 *
 * 有 tool_result 说明 Echo 已执行，mock 应进入第二轮返回最终文本。
 *
 * @param messages - 当前对话历史
 */
function historyHasToolResult(messages: CallModelParams['messages']): boolean {
  return messages.some(
    m =>
      m.type === 'user' &&
      m.content.some(b => b.type === 'tool_result'),
  )
}

/**
 * Mock 版 callModel — 固定两轮行为
 *
 * 第一轮：yield assistant(tool_use Echo)
 * 第二轮：yield text_delta + assistant(text) 模拟流式最终回答
 *
 * @param params - 与真实 callModel 相同的入参形状
 */
export async function* mockEchoCallModel(
  params: CallModelParams,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  const payload = extractEchoPayload(params.messages)

  if (!historyHasToolResult(params.messages)) {
    yield createAssistantMessage([
      {
        type: 'tool_use',
        id: `toolu_mock_${Date.now()}`,
        name: 'Echo',
        input: { message: payload },
      },
    ])
    return
  }

  const finalText = `Echo 回复: ${payload}`
  yield { type: 'text_delta', text: finalText }
  yield createAssistantMessage([{ type: 'text', text: finalText }])
}
