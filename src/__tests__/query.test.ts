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

  test('completes Read then summary multi-turn loop', async () => {
    async function* mockReadThenSummarize(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const readResult = params.messages.find(
        m =>
          m.type === 'user' &&
          m.content.some(
            b =>
              b.type === 'tool_result' &&
              !b.is_error &&
              b.content.includes('react-agent-mini'),
          ),
      )

      if (!readResult) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: { path: 'README.md' },
          },
        ])
        return
      }

      yield createAssistantMessage([
        { type: 'text', text: '总结: 最简 ReAct Agent 项目。' },
      ])
    }

    const tools = getTools()
    const context = createMinimalToolContext(tools)

    const { collected, terminal } = await drainQuery(
      query({
        messages: [createUserMessage('读取 README.md 并一句话总结')],
        tools,
        toolUseContext: context,
        deps: {
          callModel: mockReadThenSummarize,
          uuid: () => 'read-test-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })

    const readResults = collected.filter(
      item =>
        item.type === 'user' &&
        item.content.some(
          b =>
            b.type === 'tool_result' &&
            !b.is_error &&
            b.content.includes('react-agent-mini'),
        ),
    )
    expect(readResults.length).toBe(1)

    const finalText = collected
      .filter((m): m is AssistantMessage => m.type === 'assistant')
      .flatMap(m => m.content.filter(b => b.type === 'text'))
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
    expect(finalText).toContain('总结')
  })

  test('returns max_turns when tool loop exceeds limit', async () => {
    async function* mockAlwaysToolUse(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_loop',
          name: 'Echo',
          input: { message: 'loop' },
        },
      ])
    }

    const tools = getTools()
    const context = createMinimalToolContext(tools)

    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('keep calling tools')],
        tools,
        toolUseContext: context,
        maxTurns: 1,
        deps: {
          callModel: mockAlwaysToolUse,
          uuid: () => 'max-turns-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'max_turns', turnCount: 2 })
  })

  test('emits query.turn_start and query.turn_end when TRACE=1', async () => {
    const prev = process.env.TRACE
    process.env.TRACE = '1'
    const lines: string[] = []
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    }

    try {
      async function* mockTextOnly(): AsyncGenerator<
        StreamEvent | AssistantMessage
      > {
        yield createAssistantMessage([{ type: 'text', text: 'hi' }])
      }

      const tools = getTools()
      const { terminal } = await drainQuery(
        query({
          messages: [createUserMessage('hi')],
          tools,
          toolUseContext: createMinimalToolContext(tools),
          deps: {
            callModel: mockTextOnly,
            uuid: () => 'trace-turn-uuid',
          },
        }),
      )

      expect(terminal).toEqual({ reason: 'completed' })
      expect(lines.some(l => l.includes('[trace]') && l.includes('query.turn_start'))).toBe(
        true,
      )
      expect(
        lines.some(
          l =>
            l.includes('[trace]') &&
            l.includes('query.turn_end') &&
            l.includes('reason=completed'),
        ),
      ).toBe(true)
    } finally {
      console.error = originalError
      if (prev === undefined) delete process.env.TRACE
      else process.env.TRACE = prev
    }
  })
})
