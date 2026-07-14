import { describe, expect, test } from 'bun:test'
import { consumeQueryStream } from '../consumeQueryStream.js'
import type { QueryYield } from '../../types/message.js'
import type { Terminal } from '../../query/types.js'
import { createAssistantMessage, createToolResultMessage } from '../../utils/messages.js'

describe('consumeQueryStream', () => {
  test('writes text_delta to stdout and tool status to stderr', async () => {
    const stdout: string[] = []
    const stderr: string[] = []

    async function* fakeStream(): AsyncGenerator<QueryYield, Terminal> {
      yield { type: 'text_delta', text: '你好' }
      yield createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'Read',
          input: { path: 'a.ts' },
        },
      ])
      yield createToolResultMessage('toolu_1', 'ok')
      yield createAssistantMessage([{ type: 'text', text: '已读' }])
      return { reason: 'completed' }
    }

    const terminal = await consumeQueryStream(fakeStream(), {
      stdout: { write: s => stdout.push(s) },
      stderr: { write: s => stderr.push(s) },
    })

    expect(terminal).toEqual({ reason: 'completed' })
    expect(stdout.join('')).toContain('你好')
    expect(stderr.some(l => l.includes('[工具] Read: a.ts'))).toBe(true)
  })
})
