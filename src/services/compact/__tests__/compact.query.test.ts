import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { query } from '../../../query.js'
import type { CallModelParams } from '../../../query/types.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import type { Message } from '../../../types/message.js'
import {
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from '../../../utils/messages.js'
import { TRUNCATION_NOTE } from '../compact.js'

describe('query outbound compact wiring', () => {
  test('callModel receives truncated tool_result while history stays intact', async () => {
    const big = 'z'.repeat(9000)
    const messages: Message[] = [
      createUserMessage('先读大文件'),
      createAssistantMessage([
        { type: 'tool_use', id: 'toolu_big', name: 'Read', input: {} },
      ]),
      createToolResultMessage('toolu_big', big),
      createUserMessage('继续'),
    ]

    const seen: CallModelParams[] = []
    async function* fakeCallModel(params: CallModelParams) {
      seen.push(params)
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    const tools = getTools()
    const gen = query({
      messages,
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: fakeCallModel, uuid: randomUUID },
      compact: { maxToolResultChars: 1000 },
    })
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) {
      // drain
    }

    expect(seen.length).toBe(1)
    const outBlock = seen[0].messages[2]
    if (outBlock.type !== 'user') throw new Error('expected user message')
    const block = outBlock.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.content.length).toBeLessThan(2000)
    expect(block.content).toContain(TRUNCATION_NOTE)

    // 会话历史（入参数组）保持原样
    const historyBlock = messages[2]
    if (historyBlock.type !== 'user') throw new Error('expected user message')
    const original = historyBlock.content[0]
    if (original.type !== 'tool_result') throw new Error('expected tool_result')
    expect(original.content).toBe(big)
  })
})
