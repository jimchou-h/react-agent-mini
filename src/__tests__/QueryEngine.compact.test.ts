import { describe, expect, test } from 'bun:test'
import { QueryEngine } from '../QueryEngine.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createAssistantMessage } from '../utils/messages.js'
import { isCompactBoundaryMessage } from '../services/compact/autoCompact.js'
import type { CallModelParams } from '../query/types.js'
import type { AssistantMessage, Message, StreamEvent } from '../types/message.js'

async function drainTurn(
  gen: AsyncGenerator<
    import('../types/message.js').QueryYield,
    import('../query/types.js').Terminal
  >,
) {
  let terminal: import('../query/types.js').Terminal | undefined
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      terminal = value
      break
    }
  }
  return terminal
}

async function* mockTextReply(
  params: CallModelParams,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  const lastUser = [...params.messages].reverse().find(m => m.type === 'user')
  const text =
    lastUser?.content.find(b => b.type === 'text' && 'text' in b)?.text ?? ''
  yield createAssistantMessage([{ type: 'text', text: `收到: ${text}` }])
}

describe('QueryEngine.compactNow', () => {
  test('rewrites messages on success', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: mockTextReply, uuid: () => 'c' },
    })
    await drainTurn(engine.runTurn('第一轮'))
    await drainTurn(engine.runTurn('第二轮'))
    await drainTurn(engine.runTurn('第三轮'))
    const beforeLen = engine.messages.length

    const result = await engine.compactNow({
      summarize: async () => '压缩摘要',
      keepRecentMessages: 2,
    })

    expect(result.summary).toBe('压缩摘要')
    expect(engine.messages.length).toBeLessThan(beforeLen)
    expect(isCompactBoundaryMessage(engine.messages[0]!)).toBe(true)
    expect(result.before.usedPercent).toBeGreaterThanOrEqual(0)
    expect(result.after.usedPercent).toBeGreaterThanOrEqual(0)
  })

  test('leaves messages unchanged when summarize fails', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: mockTextReply, uuid: () => 'c2' },
    })
    await drainTurn(engine.runTurn('hello'))
    const snapshot = structuredClone(engine.messages)

    await expect(
      engine.compactNow({
        summarize: async () => {
          throw new Error('boom')
        },
      }),
    ).rejects.toThrow('boom')
    expect(engine.messages).toEqual(snapshot)
  })
})
