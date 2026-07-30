import { describe, expect, test } from 'bun:test'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages.js'
import type { Message } from '../../../types/message.js'
import {
  COMPACT_BOUNDARY_TEXT,
  autoCompactIfNeeded,
  compactConversation,
  getMessagesAfterCompactBoundary,
  isCompactBoundaryMessage,
  MAX_AUTOCOMPACT_FAILURES,
} from '../autoCompact.js'

function longHistory(): Message[] {
  return [
    createUserMessage('第一轮问题'),
    createAssistantMessage([{ type: 'text', text: '第一轮回答' }]),
    createUserMessage('第二轮问题'),
    createAssistantMessage([{ type: 'text', text: '第二轮回答' }]),
    createUserMessage('第三轮问题'),
    createAssistantMessage([{ type: 'text', text: '第三轮回答' }]),
    createUserMessage('最近问题'),
    createAssistantMessage([{ type: 'text', text: '最近回答' }]),
  ]
}

describe('compactConversation', () => {
  test('replaces early history with boundary + summary + tail', async () => {
    const messages = longHistory()
    const { messages: out, summary } = await compactConversation(messages, {
      summarize: async () => '这是摘要',
      keepRecentMessages: 2,
    })
    expect(summary).toBe('这是摘要')
    expect(isCompactBoundaryMessage(out[0]!)).toBe(true)
    expect(out[1]?.type).toBe('user')
    expect(
      out[1]!.content.some(
        b => b.type === 'text' && b.text.includes('这是摘要'),
      ),
    ).toBe(true)
    // keep last 2 messages
    expect(out.at(-2)).toEqual(messages.at(-2))
    expect(out.at(-1)).toEqual(messages.at(-1))
    expect(out.length).toBeLessThan(messages.length)
  })

  test('does not mutate input and leaves session unchanged on summarize failure', async () => {
    const messages = longHistory()
    const snapshot = structuredClone(messages)
    await expect(
      compactConversation(messages, {
        summarize: async () => {
          throw new Error('summarize failed')
        },
      }),
    ).rejects.toThrow('summarize failed')
    expect(messages).toEqual(snapshot)
  })

  test('rejects empty summary', async () => {
    await expect(
      compactConversation(longHistory(), {
        summarize: async () => '   ',
      }),
    ).rejects.toThrow(/empty/i)
  })
})

describe('autoCompactIfNeeded', () => {
  test('compacts when over threshold', async () => {
    const result = await autoCompactIfNeeded(longHistory(), {
      summarize: async () => '自动摘要',
      thresholdPercent: 50,
      windowTokens: 10,
      keepRecentMessages: 2,
    })
    expect(result.compacted).toBe(true)
    expect(result.reason).toBe('success')
    expect(isCompactBoundaryMessage(result.messages[0]!)).toBe(true)
  })

  test('skips when below threshold', async () => {
    const messages = longHistory()
    const result = await autoCompactIfNeeded(messages, {
      summarize: async () => '不应调用',
      thresholdPercent: 100,
      usage: { input_tokens: 1 },
    })
    expect(result.compacted).toBe(false)
    expect(result.reason).toBe('below_threshold')
    expect(result.messages).toBe(messages)
  })

  test('AUTOCOMPACT=0 disables auto but force still works', async () => {
    const prev = process.env.AUTOCOMPACT
    process.env.AUTOCOMPACT = '0'
    try {
      const skipped = await autoCompactIfNeeded(longHistory(), {
        summarize: async () => 'x',
        thresholdPercent: 1,
      })
      expect(skipped.compacted).toBe(false)
      expect(skipped.reason).toBe('autocompact_disabled')

      const forced = await autoCompactIfNeeded(longHistory(), {
        summarize: async () => '强制摘要',
        force: true,
        keepRecentMessages: 2,
      })
      expect(forced.compacted).toBe(true)
    } finally {
      if (prev == null) delete process.env.AUTOCOMPACT
      else process.env.AUTOCOMPACT = prev
    }
  })

  test('COMPACT=0 disables even force', async () => {
    const prev = process.env.COMPACT
    process.env.COMPACT = '0'
    try {
      const result = await autoCompactIfNeeded(longHistory(), {
        summarize: async () => 'x',
        force: true,
      })
      expect(result.compacted).toBe(false)
      expect(result.reason).toBe('compact_disabled')
    } finally {
      if (prev == null) delete process.env.COMPACT
      else process.env.COMPACT = prev
    }
  })

  test('circuit breaker after consecutive failures', async () => {
    const tracking = { consecutiveFailures: 0 }
    for (let i = 0; i < MAX_AUTOCOMPACT_FAILURES; i++) {
      const r = await autoCompactIfNeeded(longHistory(), {
        summarize: async () => {
          throw new Error('fail')
        },
        thresholdPercent: 50,
        windowTokens: 10,
        tracking,
      })
      expect(r.compacted).toBe(false)
      expect(r.reason).toBe('failed')
    }
    expect(tracking.consecutiveFailures).toBe(MAX_AUTOCOMPACT_FAILURES)

    let called = false
    const blocked = await autoCompactIfNeeded(longHistory(), {
      summarize: async () => {
        called = true
        return 'nope'
      },
      thresholdPercent: 50,
      windowTokens: 10,
      tracking,
    })
    expect(blocked.reason).toBe('circuit_open')
    expect(called).toBe(false)
  })

  test('failure does not rewrite messages', async () => {
    const messages = longHistory()
    const snapshot = structuredClone(messages)
    const result = await autoCompactIfNeeded(messages, {
      summarize: async () => {
        throw new Error('boom')
      },
      thresholdPercent: 50,
      windowTokens: 10,
    })
    expect(result.compacted).toBe(false)
    expect(result.messages).toEqual(snapshot)
  })
})

describe('getMessagesAfterCompactBoundary', () => {
  test('returns messages after the last boundary', async () => {
    const { messages } = await compactConversation(longHistory(), {
      summarize: async () => '摘要',
      keepRecentMessages: 2,
    })
    const after = getMessagesAfterCompactBoundary(messages)
    expect(after.some(isCompactBoundaryMessage)).toBe(false)
    expect(after[0]?.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('摘要'),
    })
  })
})

describe('compact boundary marker', () => {
  test('boundary text is stable', () => {
    expect(COMPACT_BOUNDARY_TEXT).toContain('compact boundary')
  })
})
