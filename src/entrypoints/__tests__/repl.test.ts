import { describe, expect, test } from 'bun:test'
import type { CallModelParams } from '../../query/types.js'
import type { AssistantMessage, StreamEvent } from '../../types/message.js'
import { QueryEngine } from '../../QueryEngine.js'
import { getTools } from '../../tools/index.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { isSkippableReplLine, runReplSession } from '../repl.js'

async function* mockTextReply(
  params: CallModelParams,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  const lastUser = [...params.messages].reverse().find(m => m.type === 'user')
  const text =
    lastUser?.content.find(b => b.type === 'text' && 'text' in b)?.text ?? ''
  const reply = `收到: ${text}`
  yield { type: 'text_delta', text: reply }
  yield createAssistantMessage([{ type: 'text', text: reply }])
}

describe('isSkippableReplLine', () => {
  test('skips empty and whitespace-only lines', () => {
    expect(isSkippableReplLine('')).toBe(true)
    expect(isSkippableReplLine('   ')).toBe(true)
    expect(isSkippableReplLine('hi')).toBe(false)
  })
})

describe('runReplSession', () => {
  test('skips blank lines and accumulates two turns', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: mockTextReply,
        uuid: () => 'repl-uuid',
      },
    })

    const stdout: string[] = []
    async function* lines() {
      yield ''
      yield '第一轮'
      yield '   '
      yield '第二轮'
    }

    await runReplSession({
      engine,
      lines: lines(),
      consume: async gen => {
        const terminal = await (async () => {
          while (true) {
            const { value, done } = await gen.next()
            if (done) return value
            if (value.type === 'text_delta') stdout.push(value.text)
          }
        })()
        return terminal
      },
    })

    expect(stdout.join('')).toContain('第一轮')
    expect(stdout.join('')).toContain('第二轮')
    expect(engine.messages.filter(m => m.type === 'user').length).toBe(2)
  })
})
