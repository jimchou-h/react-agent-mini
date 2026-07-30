import { describe, expect, test } from 'bun:test'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages.js'
import type { Message } from '../../../types/message.js'
import {
  COMPACT_BOUNDARY_TEXT,
  compactConversation,
  getMessagesAfterCompactBoundary,
  isCompactBoundaryMessage,
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
