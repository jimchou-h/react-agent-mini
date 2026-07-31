import { afterEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { ToolUseBlock } from '../../../types/message.js'
import type { Tool } from '../../../Tool.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import { createAssistantMessage } from '../../../utils/messages.js'
import { runToolUse } from '../execution.js'

const spyInputSchema = z.object({ value: z.string() })

function createSpyTool(onCall?: () => void): Tool<typeof spyInputSchema> {
  return {
    name: 'Spy',
    description: 'tracks whether call() ran',
    inputSchema: spyInputSchema,
    async call(args) {
      onCall?.()
      return { data: args.value }
    },
    isReadOnly() {
      return true
    },
    isConcurrencySafe() {
      return true
    },
    isEnabled() {
      return true
    },
  }
}

describe('runToolUse permissions', () => {
  test('deny skips tool.call and returns is_error tool_result', async () => {
    let called = false
    const spyTool = createSpyTool(() => {
      called = true
    })
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_deny_1',
      name: 'Spy',
      input: { value: 'secret' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([spyTool]),
      canUseTool: async () => ({
        behavior: 'deny',
        message: 'permission denied',
      }),
    })

    expect(called).toBe(false)
    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toBe('permission denied')
    }
  })

  test('default auto-allows read-only tools when canUseTool is not injected', async () => {
    const tools = getTools()
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_allow_1',
      name: 'Echo',
      input: { message: 'hi' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(
      block,
      parent,
      createMinimalToolContext(tools),
    )

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
      expect(result.content).toBe('hi')
    }
  })

  test('allow runs tool.call when canUseTool returns allow', async () => {
    let called = false
    const spyTool = createSpyTool(() => {
      called = true
    })
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_allow_2',
      name: 'Spy',
      input: { value: 'ok' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([spyTool]),
      canUseTool: async () => ({ behavior: 'allow' }),
    })

    expect(called).toBe(true)
    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
      expect(result.content).toBe('ok')
    }
  })

  test('PreToolUse deny skips tool.call and returns is_error', async () => {
    let called = false
    const spyTool = createSpyTool(() => {
      called = true
    })
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_hook_deny_1',
      name: 'Spy',
      input: { value: 'secret' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([spyTool]),
      canUseTool: async () => ({ behavior: 'allow' }),
      hooksConfig: {
        PreToolUse: [{ matcher: 'Spy', command: 'deny-hook' }],
      },
      hookExec: async () => ({
        exitCode: 2,
        stdout: '',
        stderr: 'hook blocked',
      }),
    })

    expect(called).toBe(false)
    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toBe('hook blocked')
    }
  })

  test('PostToolUse runs after call and fail-soft on error', async () => {
    let called = false
    let postPayload: unknown
    const spyTool = createSpyTool(() => {
      called = true
    })
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_hook_post_1',
      name: 'Spy',
      input: { value: 'ok' },
    }
    const parent = createAssistantMessage([block])
    const errors: string[] = []
    const prevErr = console.error
    console.error = (...args: unknown[]) => {
      errors.push(String(args[0]))
    }

    try {
      const update = await runToolUse(block, parent, {
        ...createMinimalToolContext([spyTool]),
        canUseTool: async () => ({ behavior: 'allow' }),
        hooksConfig: {
          PostToolUse: [{ matcher: 'Spy', command: 'post-hook' }],
        },
        hookExec: async (_cmd, payload) => {
          postPayload = payload
          return { exitCode: 1, stdout: '', stderr: 'post oops' }
        },
      })

      expect(called).toBe(true)
      expect(postPayload).toMatchObject({
        hook_event_name: 'PostToolUse',
        tool_name: 'Spy',
      })
      const result = update.message.content[0]
      expect(result.type).toBe('tool_result')
      if (result.type === 'tool_result') {
        expect(result.is_error).toBeUndefined()
        expect(result.content).toBe('ok')
      }
      expect(errors.some(e => e.includes('PostToolUse'))).toBe(true)
    } finally {
      console.error = prevErr
    }
  })

  test('ToolResult.isError marks tool_result as is_error', async () => {
    const tool: Tool = {
      name: 'SoftFail',
      description: 'returns soft error',
      inputSchema: z.object({}),
      async call() {
        return { data: 'soft fail', isError: true }
      },
      isReadOnly() {
        return true
      },
      isConcurrencySafe() {
        return true
      },
      isEnabled() {
        return true
      },
    }
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_soft_1',
      name: 'SoftFail',
      input: {},
    }
    const parent = createAssistantMessage([block])
    const update = await runToolUse(
      block,
      parent,
      createMinimalToolContext([tool]),
    )
    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toBe('soft fail')
    }
  })
})

describe('runToolUse trace', () => {
  const prev = process.env.TRACE
  const originalError = console.error

  afterEach(() => {
    console.error = originalError
    if (prev === undefined) delete process.env.TRACE
    else process.env.TRACE = prev
  })

  test('emits tool.start and tool.end when TRACE=1', async () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    }

    const tools = getTools()
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_trace_1',
      name: 'Echo',
      input: { message: 'hi' },
    }
    const parent = createAssistantMessage([block])

    await runToolUse(block, parent, createMinimalToolContext(tools))

    expect(
      lines.some(
        l =>
          l.includes('[trace]') &&
          l.includes('tool.start') &&
          l.includes('name=Echo'),
      ),
    ).toBe(true)
    expect(
      lines.some(
        l =>
          l.includes('[trace]') &&
          l.includes('tool.end') &&
          l.includes('name=Echo') &&
          l.includes('ok=true'),
      ),
    ).toBe(true)
  })

  test('emits hooks.pre and hooks.post when TRACE=1', async () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    }

    const spyTool = createSpyTool()
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_hook_trace_1',
      name: 'Spy',
      input: { value: 'hi' },
    }
    const parent = createAssistantMessage([block])

    await runToolUse(block, parent, {
      ...createMinimalToolContext([spyTool]),
      canUseTool: async () => ({ behavior: 'allow' }),
      hooksConfig: {
        PreToolUse: [{ matcher: 'Spy', command: 'pre' }],
        PostToolUse: [{ matcher: 'Spy', command: 'post' }],
      },
      hookExec: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    })

    expect(
      lines.some(l => l.includes('hooks.pre') && l.includes('tool=Spy')),
    ).toBe(true)
    expect(
      lines.some(l => l.includes('hooks.post') && l.includes('tool=Spy')),
    ).toBe(true)
  })
})
