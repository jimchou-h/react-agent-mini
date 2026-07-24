import { afterEach, describe, expect, test } from 'bun:test'
import type { Message } from '../../../types/message.js'
import { compactMessages, TRUNCATION_NOTE } from '../compact.js'
import {
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from '../../../utils/messages.js'

function toolTurn(id: string, resultContent: string): Message[] {
  return [
    createAssistantMessage([
      { type: 'tool_use', id, name: 'Read', input: { path: 'a.txt' } },
    ]),
    createToolResultMessage(id, resultContent),
  ]
}

describe('compactMessages tool_result truncation', () => {
  test('truncates oversized tool_result content and appends note', () => {
    const big = 'x'.repeat(5000)
    const messages: Message[] = [
      createUserMessage('读文件'),
      ...toolTurn('toolu_1', big),
    ]

    const out = compactMessages(messages, { maxToolResultChars: 4000 })

    const result = out[2]
    if (result.type !== 'user') throw new Error('expected user message')
    const block = result.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.content.length).toBeLessThan(5000)
    expect(block.content).toContain(TRUNCATION_NOTE)
    expect(block.content.startsWith('x'.repeat(100))).toBe(true)
  })

  test('keeps tool_use_id and is_error on truncated blocks', () => {
    const messages: Message[] = [
      createUserMessage('q'),
      createAssistantMessage([
        { type: 'tool_use', id: 'toolu_e', name: 'Read', input: {} },
      ]),
      createToolResultMessage('toolu_e', 'e'.repeat(9000), true),
    ]

    const out = compactMessages(messages, { maxToolResultChars: 100 })
    const result = out[2]
    if (result.type !== 'user') throw new Error('expected user message')
    const block = result.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.tool_use_id).toBe('toolu_e')
    expect(block.is_error).toBe(true)
  })

  test('does not mutate the original messages (outbound-only)', () => {
    const big = 'y'.repeat(6000)
    const messages: Message[] = [
      createUserMessage('q'),
      ...toolTurn('toolu_2', big),
    ]

    compactMessages(messages, { maxToolResultChars: 1000 })

    const original = messages[2]
    if (original.type !== 'user') throw new Error('expected user message')
    const block = original.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.content).toBe(big)
  })

  test('returns the same array when nothing needs compacting', () => {
    const messages: Message[] = [
      createUserMessage('hi'),
      ...toolTurn('toolu_3', 'short'),
    ]

    const out = compactMessages(messages, { maxToolResultChars: 4000 })
    expect(out).toBe(messages)
  })

  test('short tool_result and text blocks pass through unchanged', () => {
    const messages: Message[] = [
      createUserMessage('hello'),
      ...toolTurn('toolu_4', 'ok'),
      createAssistantMessage([{ type: 'text', text: 'done' }]),
    ]

    const out = compactMessages(messages, { maxToolResultChars: 4000 })
    expect(out).toEqual(messages)
  })
})

describe('compactMessages maxMessages tail retention', () => {
  function conversation(turns: number): Message[] {
    const messages: Message[] = []
    for (let i = 0; i < turns; i++) {
      messages.push(createUserMessage(`问题${i}`))
      messages.push(...toolTurn(`toolu_${i}`, `结果${i}`))
      messages.push(
        createAssistantMessage([{ type: 'text', text: `回答${i}` }]),
      )
    }
    return messages
  }

  test('drops oldest turns when over maxMessages', () => {
    const messages = conversation(10) // 40 条
    const out = compactMessages(messages, { maxMessages: 12 })

    expect(out.length).toBeLessThanOrEqual(12)
    // 最新轮次完整保留
    const last = out.at(-1)
    expect(last).toEqual(messages.at(-1)!)
  })

  test('trim boundary starts at a user text message (no orphan tool_result)', () => {
    const messages = conversation(10)
    const out = compactMessages(messages, { maxMessages: 10 })

    const first = out[0]
    if (first.type !== 'user') throw new Error('expected user message first')
    expect(first.content.every(b => b.type === 'text')).toBe(true)

    // 所有 tool_result 都有同列表中的配对 tool_use
    const toolUseIds = new Set(
      out.flatMap(m =>
        m.content.filter(b => b.type === 'tool_use').map(b => b.id),
      ),
    )
    for (const m of out) {
      for (const b of m.content) {
        if (b.type === 'tool_result') {
          expect(toolUseIds.has(b.tool_use_id)).toBe(true)
        }
      }
    }
  })

  test('returns same array when within maxMessages', () => {
    const messages = conversation(2) // 8 条
    const out = compactMessages(messages, { maxMessages: 40 })
    expect(out).toBe(messages)
  })

  test('applies both truncation and tail retention together', () => {
    const messages: Message[] = [
      ...conversation(8),
      createUserMessage('再读一次'),
      ...toolTurn('toolu_big', 'w'.repeat(9000)),
    ]
    const out = compactMessages(messages, {
      maxMessages: 8,
      maxToolResultChars: 500,
    })

    expect(out.length).toBeLessThanOrEqual(8)
    const result = out.at(-1)
    if (result?.type !== 'user') throw new Error('expected user message')
    const block = result.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.content).toContain(TRUNCATION_NOTE)
    expect(block.content.length).toBeLessThan(1000)
  })
})

describe('compactMessages disable switch', () => {
  const prevCompact = process.env.COMPACT

  afterEach(() => {
    if (prevCompact === undefined) delete process.env.COMPACT
    else process.env.COMPACT = prevCompact
  })

  test('enabled: false returns messages untouched', () => {
    const messages: Message[] = [
      createUserMessage('q'),
      ...toolTurn('toolu_off', 'x'.repeat(9000)),
    ]
    const out = compactMessages(messages, {
      enabled: false,
      maxToolResultChars: 100,
      maxMessages: 1,
    })
    expect(out).toBe(messages)
  })

  test('COMPACT=0 env disables compaction by default', () => {
    process.env.COMPACT = '0'
    const messages: Message[] = [
      createUserMessage('q'),
      ...toolTurn('toolu_env', 'x'.repeat(9000)),
    ]
    const out = compactMessages(messages, { maxToolResultChars: 100 })
    expect(out).toBe(messages)
  })
})

describe('compactMessages TRACE', () => {
  const prevTrace = process.env.TRACE
  const originalError = console.error

  afterEach(() => {
    if (prevTrace === undefined) delete process.env.TRACE
    else process.env.TRACE = prevTrace
    console.error = originalError
  })

  test('emits [trace] compact.run when real compaction happens', () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.join(' '))
    }

    const messages: Message[] = [
      createUserMessage('q'),
      ...toolTurn('toolu_t', 'x'.repeat(9000)),
    ]
    compactMessages(messages, { maxToolResultChars: 100 })

    const traceLine = lines.find(l => l.includes('compact.run'))
    expect(traceLine).toBeDefined()
    expect(traceLine).toContain('[trace]')
    expect(traceLine).toContain('truncatedBlocks=1')
  })

  test('emits nothing when no compaction occurs', () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.join(' '))
    }

    compactMessages([createUserMessage('hi')], {})
    expect(lines.some(l => l.includes('compact.run'))).toBe(false)
  })
})