import { describe, expect, test, beforeEach } from 'bun:test'
import { QueryEngine } from '../../QueryEngine.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { getTools } from '../../tools/index.js'
import type { Message } from '../../types/message.js'
import { HostBridge } from '../HostBridge.js'
import { resetHostIdSeq } from '../types.js'

function mockCallModel(replies: string[]) {
  let i = 0
  return async function* () {
    const text = replies[i] ?? replies[replies.length - 1] ?? ''
    i += 1
    for (const ch of text) {
      yield { type: 'text_delta' as const, text: ch }
    }
    const msg: Message = {
      type: 'assistant',
      content: [{ type: 'text', text }],
    }
    yield msg
  }
}

describe('HostBridge', () => {
  beforeEach(() => {
    resetHostIdSeq()
  })

  test('submitUserText streams assistant text into snapshot', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: mockCallModel(['hello']) },
    })
    const bridge = new HostBridge({ engine })
    const snaps: string[] = []
    bridge.subscribe(s => {
      if (s.streamingText) snaps.push(s.streamingText)
    })

    const ok = await bridge.submitUserText('hi')
    expect(ok).toBe(true)

    const final = bridge.snapshot()
    expect(final.turnInProgress).toBe(false)
    expect(final.items.some(i => i.kind === 'user' && i.text === 'hi')).toBe(
      true,
    )
    expect(
      final.items.some(i => i.kind === 'assistant' && i.text.includes('hello')),
    ).toBe(true)
    expect(final.ctxPercent).toBeTruthy()
    expect(snaps.length).toBeGreaterThan(0)
  })

  test('empty line is skipped', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: mockCallModel(['x']) },
    })
    const bridge = new HostBridge({ engine })
    expect(await bridge.submitUserText('   ')).toBe(false)
    expect(bridge.snapshot().items).toHaveLength(0)
  })

  test('second turn sees first turn history on engine', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: { callModel: mockCallModel(['one', 'two']) },
    })
    const bridge = new HostBridge({ engine })
    await bridge.submitUserText('a')
    await bridge.submitUserText('b')
    expect(engine.messages.length).toBeGreaterThanOrEqual(4)
  })
})
