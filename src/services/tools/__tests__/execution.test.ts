import { afterEach, describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/message.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import { createAssistantMessage } from '../../../utils/messages.js'
import { runToolUse } from '../execution.js'

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
})
