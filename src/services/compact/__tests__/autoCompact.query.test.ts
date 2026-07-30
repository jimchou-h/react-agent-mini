import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { query } from '../../../query.js'
import type { CallModelParams } from '../../../query/types.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import type { Message } from '../../../types/message.js'
import {
  createAssistantMessage,
  createUserMessage,
} from '../../../utils/messages.js'
import { isCompactBoundaryMessage } from '../autoCompact.js'

describe('query autocompact wiring', () => {
  test('rewrites session messages when autocompact succeeds', async () => {
    const messages: Message[] = [
      createUserMessage('a'.repeat(200)),
      createAssistantMessage([{ type: 'text', text: 'b'.repeat(200) }]),
      createUserMessage('c'.repeat(200)),
      createAssistantMessage([{ type: 'text', text: 'd'.repeat(200) }]),
      createUserMessage('继续'),
    ]
    const beforeLen = messages.length

    async function* fakeCallModel(params: CallModelParams) {
      // After compact, history should be shorter / contain boundary
      const hasBoundary = params.messages.some(isCompactBoundaryMessage)
      expect(hasBoundary).toBe(true)
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    const tools = getTools()
    const gen = query({
      messages,
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: fakeCallModel,
        uuid: randomUUID,
        autocompact: async (msgs) => {
          const { compactConversation } = await import('../autoCompact.js')
          const { messages: next } = await compactConversation(msgs, {
            summarize: async () => 'query摘要',
            keepRecentMessages: 2,
          })
          return { compacted: true, messages: next, reason: 'success' }
        },
      },
    })

    while (true) {
      const { done } = await gen.next()
      if (done) break
    }

    expect(messages.length).toBeLessThan(beforeLen)
    expect(isCompactBoundaryMessage(messages[0]!)).toBe(true)
  })

  test('AUTOCOMPACT off keeps session unchanged on no-op autocompact', async () => {
    const messages: Message[] = [createUserMessage('短会话')]
    const snapshot = structuredClone(messages)

    async function* fakeCallModel() {
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    const tools = getTools()
    const gen = query({
      messages,
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: fakeCallModel,
        uuid: randomUUID,
        autocompact: async (msgs) => ({
          compacted: false,
          messages: msgs,
          reason: 'autocompact_disabled',
        }),
      },
    })

    while (true) {
      const { done } = await gen.next()
      if (done) break
    }

    expect(messages).toEqual(snapshot)
  })
})
