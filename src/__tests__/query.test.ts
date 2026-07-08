import { describe, expect, test } from 'bun:test'
import type { CallModelParams } from '../query/types.js'
import type { AssistantMessage, Message, StreamEvent } from '../types/message.js'
import { query } from '../query.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createUserMessage, createAssistantMessage } from '../utils/messages.js'

/** 测试用 mock：第一轮 Echo tool_use，第二轮纯文本 */
async function* mockEchoThenText(
  params: CallModelParams,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  const hasToolResult = params.messages.some(
    m =>
      m.type === 'user' &&
      m.content.some(b => b.type === 'tool_result'),
  )

  if (!hasToolResult) {
    yield createAssistantMessage([
      {
        type: 'tool_use',
        id: 'toolu_mock_1',
        name: 'Echo',
        input: { message: 'hello' },
      },
    ])
    return
  }

  yield { type: 'text_delta', text: 'Echo 已回复: hello' }
  yield createAssistantMessage([{ type: 'text', text: 'Echo 已回复: hello' }])
}

/** 消费 query 生成器并返回 Terminal */
async function drainQuery(
  gen: AsyncGenerator<import('../types/message.js').QueryYield, import('../query/types.js').Terminal>,
) {
  const collected: Array<StreamEvent | Message> = []
  let terminal: import('../query/types.js').Terminal | undefined
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      terminal = value
      break
    }
    collected.push(value)
  }
  return { collected, terminal }
}

describe('query', () => {
  test('completes Echo loop with injected mock callModel', async () => {
    const tools = getTools()
    const context = createMinimalToolContext(tools)
    const messages: Message[] = [createUserMessage('用 Echo 回复 hello')]

    const { collected, terminal } = await drainQuery(
      query({
        messages,
        tools,
        toolUseContext: context,
        maxTurns: 10,
        deps: {
          callModel: mockEchoThenText,
          uuid: () => 'test-uuid-1',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })

    const toolResults = collected.filter(
      item =>
        item.type === 'user' &&
        item.content.some(b => b.type === 'tool_result' && b.content === 'hello'),
    )
    expect(toolResults.length).toBeGreaterThan(0)

    const finalAssistant = collected
      .filter((m): m is AssistantMessage => m.type === 'assistant')
      .at(-1)
    expect(finalAssistant?.content.some(b => b.type === 'text')).toBe(true)
  })

  test('runs tool when response has tool_use regardless of stop_reason', async () => {
    async function* mockWithToolUse(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const hasToolResult = params.messages.some(
        m =>
          m.type === 'user' &&
          m.content.some(b => b.type === 'tool_result'),
      )
      if (!hasToolResult) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'toolu_x',
            name: 'Echo',
            input: { message: 'ping' },
          },
        ])
        return
      }
      yield createAssistantMessage([{ type: 'text', text: 'done' }])
    }

    const tools = getTools()
    const context = createMinimalToolContext(tools)

    let sawToolResult = false
    const gen = query({
      messages: [createUserMessage('test')],
      tools,
      toolUseContext: context,
      deps: {
        callModel: mockWithToolUse,
        uuid: () => 'id-2',
      },
    })

    let terminal
    while (true) {
      const { value, done } = await gen.next()
      if (done) {
        terminal = value
        break
      }
      if (
        value.type === 'user' &&
        value.content.some(
          b => b.type === 'tool_result' && b.content === 'ping',
        )
      ) {
        sawToolResult = true
      }
    }
    expect(sawToolResult).toBe(true)
    expect(terminal).toEqual({ reason: 'completed' })
  })
})
