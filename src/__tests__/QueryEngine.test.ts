import { describe, expect, test } from 'bun:test'
import type { CallModelParams } from '../query/types.js'
import type { AssistantMessage, Message, StreamEvent } from '../types/message.js'
import { QueryEngine } from '../QueryEngine.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createAssistantMessage } from '../utils/messages.js'

async function drainTurn(
  gen: AsyncGenerator<
    import('../types/message.js').QueryYield,
    import('../query/types.js').Terminal
  >,
) {
  const collected: Array<StreamEvent | Message> = []
  let terminal: import('../query/types.js').Terminal | undefined
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      terminal = value
      break
    }
    collected.push(value)
  }
  return { collected, terminal }
}

/** 纯文本回复：根据最后一条 user 文本回声 */
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

describe('QueryEngine', () => {
  test('accumulates messages across two runTurn calls', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: mockTextReply,
        uuid: () => 'qe-uuid',
      },
    })

    const turn1 = await drainTurn(engine.runTurn('我叫 Alice'))
    expect(turn1.terminal).toEqual({ reason: 'completed' })

    const turn2 = await drainTurn(engine.runTurn('我叫什么'))
    expect(turn2.terminal).toEqual({ reason: 'completed' })

    const users = engine.messages.filter(m => m.type === 'user')
    const assistants = engine.messages.filter(m => m.type === 'assistant')
    expect(users.length).toBeGreaterThanOrEqual(2)
    expect(assistants.length).toBeGreaterThanOrEqual(2)

    const userTexts = users
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
    expect(userTexts).toContain('我叫 Alice')
    expect(userTexts).toContain('我叫什么')
  })

  test('clear resets message history', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: mockTextReply,
        uuid: () => 'qe-clear',
      },
    })

    await drainTurn(engine.runTurn('先聊一轮'))
    expect(engine.messages.length).toBeGreaterThan(0)

    engine.clear()
    expect(engine.messages).toEqual([])
  })

  test('forwards maxTurns to query and returns max_turns terminal', async () => {
    async function* alwaysToolUse(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_loop',
          name: 'Echo',
          input: { message: 'loop' },
        },
      ])
    }

    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      maxTurns: 1,
      deps: {
        callModel: alwaysToolUse,
        uuid: () => 'qe-max',
      },
    })

    const { terminal } = await drainTurn(engine.runTurn('keep looping'))
    expect(terminal).toEqual({ reason: 'max_turns', turnCount: 2 })
  })

  test('runTurn yields text_delta and assistant like query', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: mockTextReply,
        uuid: () => 'qe-yield',
      },
    })

    const { collected, terminal } = await drainTurn(engine.runTurn('你好'))
    expect(terminal).toEqual({ reason: 'completed' })
    expect(collected.some(c => c.type === 'text_delta')).toBe(true)
    expect(collected.some(c => c.type === 'assistant')).toBe(true)
  })
})
