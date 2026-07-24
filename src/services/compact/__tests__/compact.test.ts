import { describe, expect, test } from 'bun:test'
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
