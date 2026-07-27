import { afterEach, describe, expect, test } from 'bun:test'
import type { Message } from '../../../types/message.js'
import { compactMessages, MICROCOMPACT_NOTE, TRUNCATION_NOTE } from '../compact.js'
import {
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from '../../../utils/messages.js'

function toolTurn(id: string, resultContent: string): Message[] {
  return [
    createAssistantMessage([
      { type: 'tool_use', id, name: 'Read', input: { file_path: 'a.txt' } },
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

  /** 强制超过阈值，使保尾路径生效（v4：低于阈值不丢轮） */
  const forceHeavy = { maxOutboundChars: 0 }

  test('drops oldest turns when over maxMessages', () => {
    const messages = conversation(10) // 40 条
    const out = compactMessages(messages, { maxMessages: 12, ...forceHeavy })

    expect(out.length).toBeLessThanOrEqual(12)
    // 最新轮次完整保留
    const last = out.at(-1)
    expect(last).toEqual(messages.at(-1)!)
  })

  test('trim boundary starts at a user text message (no orphan tool_result)', () => {
    const messages = conversation(10)
    const out = compactMessages(messages, { maxMessages: 10, ...forceHeavy })

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
      ...forceHeavy,
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

describe('compactMessages outbound threshold', () => {
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

  const prevThreshold = process.env.COMPACT_THRESHOLD_CHARS

  afterEach(() => {
    if (prevThreshold === undefined) delete process.env.COMPACT_THRESHOLD_CHARS
    else process.env.COMPACT_THRESHOLD_CHARS = prevThreshold
  })

  test('below threshold does not drop turns via maxMessages', () => {
    const messages = conversation(10) // 40 条，内容很短
    const out = compactMessages(messages, {
      maxMessages: 12,
      maxOutboundChars: 1_000_000,
    })

    expect(out.length).toBe(messages.length)
    expect(out).toBe(messages)
  })

  test('still truncates a single oversized tool_result below threshold', () => {
    const messages: Message[] = [
      createUserMessage('读大文件'),
      ...toolTurn('toolu_bomb', 'z'.repeat(9000)),
    ]
    const out = compactMessages(messages, {
      maxToolResultChars: 200,
      maxOutboundChars: 1_000_000,
    })

    expect(out).not.toBe(messages)
    const result = out[2]
    if (result.type !== 'user') throw new Error('expected user message')
    const block = result.content[0]
    if (block.type !== 'tool_result') throw new Error('expected tool_result')
    expect(block.content).toContain(TRUNCATION_NOTE)
    expect(block.content.length).toBeLessThan(9000)
  })

  test('COMPACT_THRESHOLD_CHARS env sets the default threshold', () => {
    process.env.COMPACT_THRESHOLD_CHARS = '50'
    const messages = conversation(10)
    // 短会话估算通常 > 50，应触发保尾
    const out = compactMessages(messages, { maxMessages: 12 })
    expect(out.length).toBeLessThanOrEqual(12)
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
describe('compactMessages microcompact', () => {
  const prevCompact = process.env.COMPACT
  const prevTrace = process.env.TRACE
  const originalError = console.error

  afterEach(() => {
    if (prevCompact === undefined) delete process.env.COMPACT
    else process.env.COMPACT = prevCompact
    if (prevTrace === undefined) delete process.env.TRACE
    else process.env.TRACE = prevTrace
    console.error = originalError
  })

  function longHistory(): Message[] {
    const messages: Message[] = []
    for (let i = 0; i < 6; i++) {
      messages.push(createUserMessage(`问题${i}`))
      messages.push(
        createAssistantMessage([
          {
            type: 'tool_use',
            id: `toolu_m${i}`,
            name: 'Read',
            input: { file_path: `f${i}.txt` },
          },
        ]),
      )
      messages.push(
        createToolResultMessage(`toolu_m${i}`, `BODY${i}:` + 'x'.repeat(800)),
      )
      messages.push(
        createAssistantMessage([{ type: 'text', text: `回答${i}` }]),
      )
    }
    return messages
  }

  test('replaces older oversized tool_results with placeholder and keeps recent window', () => {
    const messages = longHistory()
    const out = compactMessages(messages, {
      maxOutboundChars: 0,
      microKeepRecent: 2,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 100,
    })

    const results = out.flatMap(m =>
      m.type === 'user'
        ? m.content.filter(b => b.type === 'tool_result')
        : [],
    )
    expect(results.length).toBe(6)

    const early = results[0]
    if (early.type !== 'tool_result') throw new Error('expected tool_result')
    expect(early.content).toContain(MICROCOMPACT_NOTE)
    expect(early.content).toContain('f0.txt')
    expect(early.content.length).toBeLessThan(200)

    const recent = results[5]
    if (recent.type !== 'tool_result') throw new Error('expected tool_result')
    expect(recent.content).toContain('BODY5:')
    expect(recent.content).not.toContain(MICROCOMPACT_NOTE)
  })

  test('keeps tool_use / tool_result pairing after microcompact', () => {
    const messages = longHistory()
    const out = compactMessages(messages, {
      maxOutboundChars: 0,
      microKeepRecent: 1,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 100,
    })

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

  test('COMPACT=0 skips microcompact', () => {
    process.env.COMPACT = '0'
    const messages = longHistory()
    const out = compactMessages(messages, {
      maxOutboundChars: 0,
      microKeepRecent: 1,
      microMinChars: 100,
    })
    expect(out).toBe(messages)
  })

  test('combines microcompact with maxMessages tail retention', () => {
    const messages = longHistory()
    const out = compactMessages(messages, {
      maxOutboundChars: 0,
      microKeepRecent: 2,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 8,
    })

    expect(out.length).toBeLessThanOrEqual(8)
    expect(messages.length).toBeGreaterThan(out.length)
    const original = messages.find(
      m =>
        m.type === 'user' &&
        m.content.some(
          b => b.type === 'tool_result' && b.content.includes('BODY0:'),
        ),
    )
    expect(original).toBeDefined()
    if (original?.type === 'user') {
      const block = original.content.find(b => b.type === 'tool_result')
      if (block?.type === 'tool_result') {
        expect(block.content).toContain('BODY0:')
        expect(block.content).not.toContain(MICROCOMPACT_NOTE)
      }
    }
  })

  test('TRACE emits compact.micro when placeholders are applied', () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.join(' '))
    }

    compactMessages(longHistory(), {
      maxOutboundChars: 0,
      microKeepRecent: 1,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 100,
    })

    const micro = lines.find(l => l.includes('compact.micro'))
    expect(micro).toBeDefined()
    expect(micro).toContain('replaced=')
    const run = lines.find(l => l.includes('compact.run'))
    expect(run).toBeDefined()
    expect(run).toMatch(/strategy=.*micro/)
  })

  test('does not microcompact Echo tool results', () => {
    const messages: Message[] = [
      createUserMessage('q0'),
      createAssistantMessage([
        { type: 'tool_use', id: 'toolu_echo', name: 'Echo', input: {} },
      ]),
      createToolResultMessage('toolu_echo', 'E'.repeat(800)),
      createUserMessage('q1'),
      createAssistantMessage([
        { type: 'tool_use', id: 'toolu_read', name: 'Read', input: { file_path: 'a.txt' } },
      ]),
      createToolResultMessage('toolu_read', 'R'.repeat(800)),
    ]

    const out = compactMessages(messages, {
      maxOutboundChars: 0,
      microKeepRecent: 0,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 100,
    })

    const echoResult = out
      .flatMap(m => (m.type === 'user' ? m.content : []))
      .find(b => b.type === 'tool_result' && b.tool_use_id === 'toolu_echo')
    if (echoResult?.type !== 'tool_result') throw new Error('missing echo result')
    expect(echoResult.content).toContain('EEEE')
    expect(echoResult.content).not.toContain(MICROCOMPACT_NOTE)
  })

  test('after microcompact drops under threshold, retainTail is skipped', () => {
    // 6 段长结果：超阈值会 micro；占位后总字符回落，保尾不应再丢轮
    const messages = longHistory()
    const beforeLen = messages.length
    const out = compactMessages(messages, {
      maxOutboundChars: 2000,
      microKeepRecent: 1,
      microMinChars: 100,
      maxToolResultChars: 50_000,
      maxMessages: 8,
    })

    expect(out.length).toBe(beforeLen)
    const results = out.flatMap(m =>
      m.type === 'user'
        ? m.content.filter(b => b.type === 'tool_result')
        : [],
    )
    const early = results[0]
    if (early.type !== 'tool_result') throw new Error('expected tool_result')
    expect(early.content).toContain(MICROCOMPACT_NOTE)
  })
})
