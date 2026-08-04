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
            input: { file_path: 'README.md' },
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

  test('forwards systemPrompt to callModel', async () => {
    let seenSystemPrompt: string | undefined
    async function* captureCallModel(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      seenSystemPrompt = params.systemPrompt
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: createMinimalToolContext(tools),
        systemPrompt: 'project rules',
        deps: {
          callModel: captureCallModel,
          uuid: () => 'system-prompt-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(seenSystemPrompt).toBe('project rules')
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

  test('forwards abortController.signal to callModel', async () => {
    const tools = getTools()
    const abortController = new AbortController()
    let seenSignal: AbortSignal | undefined

    async function* mockCaptureSignal(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      seenSignal = params.signal
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          abortController,
        },
        deps: { callModel: mockCaptureSignal },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(seenSignal).toBe(abortController.signal)
  })

  test('returns aborted when signal aborts during callModel stream', async () => {
    const tools = getTools()
    const abortController = new AbortController()

    async function* mockStreamThenAbort(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      yield { type: 'text_delta', text: 'partial' }
      await new Promise<never>((_resolve, reject) => {
        const fail = () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (params.signal?.aborted) {
          fail()
          return
        }
        params.signal?.addEventListener('abort', fail, { once: true })
      })
    }

    const gen = query({
      messages: [createUserMessage('stream')],
      tools,
      toolUseContext: {
        ...createMinimalToolContext(tools),
        abortController,
      },
      deps: { callModel: mockStreamThenAbort },
    })

    const first = await gen.next()
    expect(first.done).toBe(false)
    expect(first.value).toEqual({ type: 'text_delta', text: 'partial' })

    abortController.abort('interrupt')

    const { terminal, collected } = await drainQuery(gen)
    expect(collected).toEqual([])
    expect(terminal).toEqual({ reason: 'aborted' })
  })

  test('returns aborted when abortController is aborted after tool deny', async () => {
    async function* mockWriteOnce(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_write_abort',
          name: 'Write',
          input: { file_path: 'x.txt', content: 'nope' },
        },
      ])
    }

    const tools = getTools()
    const abortController = new AbortController()
    const { terminal, collected } = await drainQuery(
      query({
        messages: [createUserMessage('write')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          abortController,
          canUseTool: async () => {
            abortController.abort('user_reject')
            return {
              behavior: 'deny',
              message: '用户拒绝了该工具调用',
            }
          },
        },
        deps: {
          callModel: mockWriteOnce,
          uuid: () => 'abort-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'aborted' })
    const toolResults = collected.filter(
      m =>
        m.type === 'user' &&
        m.content.some(b => b.type === 'tool_result' && b.is_error === true),
    )
    expect(toolResults.length).toBe(1)
  })

  test('aborted mid-batch still yields tool_result for every tool_use', async () => {
    async function* mockBatch(): AsyncGenerator<StreamEvent | AssistantMessage> {
      yield createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_echo_ok',
          name: 'Echo',
          input: { message: 'before' },
        },
        {
          type: 'tool_use',
          id: 'toolu_write_deny',
          name: 'Write',
          input: { file_path: 'x.txt', content: 'nope' },
        },
        {
          type: 'tool_use',
          id: 'toolu_echo_skip',
          name: 'Echo',
          input: { message: 'after' },
        },
      ])
    }

    const tools = getTools()
    const abortController = new AbortController()
    const { terminal, collected } = await drainQuery(
      query({
        messages: [createUserMessage('batch')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          abortController,
          canUseTool: async tool => {
            if (tool.name === 'Write') {
              abortController.abort('user_reject')
              return {
                behavior: 'deny',
                message: '用户拒绝了该工具调用',
              }
            }
            return { behavior: 'allow' }
          },
        },
        deps: {
          callModel: mockBatch,
          uuid: () => 'abort-batch-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'aborted' })

    const resultIds: string[] = []
    for (const m of collected) {
      if (m.type !== 'user') continue
      for (const b of m.content) {
        if (b.type === 'tool_result') resultIds.push(b.tool_use_id)
      }
    }
    expect(resultIds).toEqual([
      'toolu_echo_ok',
      'toolu_write_deny',
      'toolu_echo_skip',
    ])

    const skipped = collected
      .flatMap(m => (m.type === 'user' ? m.content : []))
      .find(
        b =>
          b.type === 'tool_result' && b.tool_use_id === 'toolu_echo_skip',
      )
    expect(skipped?.type).toBe('tool_result')
    if (skipped?.type === 'tool_result') {
      expect(skipped.is_error).toBe(true)
      expect(skipped.content).toContain('Skipped because')
    }
  })

  test('runs Stop hooks once on completed at depth 0', async () => {
    let stopCalls = 0
    async function* mockTextOnly(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([{ type: 'text', text: 'done' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: {
            Stop: [{ command: 'stop-a' }, { command: 'stop-b' }],
          },
          hookExec: async () => {
            stopCalls++
            return { exitCode: 0, stdout: '', stderr: '' }
          },
        },
        deps: { callModel: mockTextOnly, uuid: () => 'stop-0' },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(stopCalls).toBe(2)
  })

  test('skips Stop hooks when depth >= 1', async () => {
    let stopCalls = 0
    async function* mockTextOnly(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([{ type: 'text', text: 'nested' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        depth: 1,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: { Stop: [{ command: 'stop' }] },
          hookExec: async () => {
            stopCalls++
            return { exitCode: 0, stdout: '', stderr: '' }
          },
        },
        deps: { callModel: mockTextOnly, uuid: () => 'stop-depth' },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(stopCalls).toBe(0)
  })

  test('Stop non-zero exit does not force another model turn', async () => {
    let modelCalls = 0
    async function* mockTextOnly(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      modelCalls++
      yield createAssistantMessage([{ type: 'text', text: 'once' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: { Stop: [{ command: 'fail' }] },
          hookExec: async () => ({
            exitCode: 1,
            stdout: '',
            stderr: 'boom',
          }),
        },
        deps: { callModel: mockTextOnly, uuid: () => 'stop-fail' },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(modelCalls).toBe(1)
  })

  test('HOOKS=0 skips Stop when config is loaded from disk', async () => {
    const prev = process.env.HOOKS
    process.env.HOOKS = '0'
    let stopCalls = 0
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
          toolUseContext: {
            tools,
            // 不注入 hooksConfig → 走 loadHooksConfig；HOOKS=0 → null
            hookExec: async () => {
              stopCalls++
              return { exitCode: 0, stdout: '', stderr: '' }
            },
          },
          deps: { callModel: mockTextOnly, uuid: () => 'stop-hooks0' },
        }),
      )

      expect(terminal).toEqual({ reason: 'completed' })
      expect(stopCalls).toBe(0)
    } finally {
      if (prev === undefined) delete process.env.HOOKS
      else process.env.HOOKS = prev
    }
  })

  test('TRACE=1 emits hooks.stop on completed', async () => {
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
      await drainQuery(
        query({
          messages: [createUserMessage('hi')],
          tools,
          toolUseContext: {
            ...createMinimalToolContext(tools),
            hooksConfig: { Stop: [{ command: 't' }] },
            hookExec: async () => ({
              exitCode: 0,
              stdout: '',
              stderr: '',
            }),
          },
          deps: { callModel: mockTextOnly, uuid: () => 'stop-trace' },
        }),
      )

      expect(lines.some(l => l.includes('hooks.stop'))).toBe(true)
    } finally {
      console.error = originalError
      if (prev === undefined) delete process.env.TRACE
      else process.env.TRACE = prev
    }
  })

  test('exit 2 Stop injects feedback and calls model again', async () => {
    let modelCalls = 0
    const stopPayloads: Array<{ stop_hook_active?: boolean }> = []

    async function* mockTwoTexts(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      modelCalls++
      const hasFeedback = params.messages.some(
        m =>
          m.type === 'user' &&
          m.content.some(
            b =>
              b.type === 'text' &&
              b.text.includes('Stop hook feedback:'),
          ),
      )
      if (!hasFeedback) {
        yield createAssistantMessage([{ type: 'text', text: 'first' }])
        return
      }
      yield createAssistantMessage([{ type: 'text', text: 'after-stop' }])
    }

    let stopRound = 0
    const tools = getTools()
    const { collected, terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: { Stop: [{ command: 'block' }] },
          hookExec: async (_cmd, payload) => {
            stopPayloads.push(payload as { stop_hook_active?: boolean })
            stopRound++
            if (stopRound === 1) {
              return { exitCode: 2, stdout: '', stderr: 'need more' }
            }
            return { exitCode: 0, stdout: '', stderr: '' }
          },
        },
        deps: { callModel: mockTwoTexts, uuid: () => 'stop-block' },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(modelCalls).toBe(2)
    expect(stopPayloads[0]?.stop_hook_active).toBe(false)
    expect(stopPayloads[1]?.stop_hook_active).toBe(true)

    const feedback = collected.find(
      m =>
        m.type === 'user' &&
        m.content.some(
          b =>
            b.type === 'text' &&
            b.text.includes('Stop hook feedback:') &&
            b.text.includes('need more'),
        ),
    )
    expect(feedback).toBeDefined()
  })

  test('continue false ends without another model turn even on exit 2', async () => {
    let modelCalls = 0
    async function* mockTextOnly(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      modelCalls++
      yield createAssistantMessage([{ type: 'text', text: 'once' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: { Stop: [{ command: 'stop' }] },
          hookExec: async () => ({
            exitCode: 2,
            stdout: JSON.stringify({ continue: false }),
            stderr: 'ignored',
          }),
        },
        deps: { callModel: mockTextOnly, uuid: () => 'stop-prevent' },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })
    expect(modelCalls).toBe(1)
  })

  test('repeated Stop blocking hits maxTurns', async () => {
    async function* mockAlwaysText(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([{ type: 'text', text: 'again' }])
    }

    const tools = getTools()
    const { terminal } = await drainQuery(
      query({
        messages: [createUserMessage('hi')],
        tools,
        maxTurns: 2,
        toolUseContext: {
          ...createMinimalToolContext(tools),
          hooksConfig: { Stop: [{ command: 'loop' }] },
          hookExec: async () => ({
            exitCode: 2,
            stdout: '',
            stderr: 'again',
          }),
        },
        deps: { callModel: mockAlwaysText, uuid: () => 'stop-max' },
      }),
    )

    expect(terminal?.reason).toBe('max_turns')
  })
})
