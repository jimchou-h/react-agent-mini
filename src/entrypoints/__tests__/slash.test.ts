import { describe, expect, test } from 'bun:test'
import { QueryEngine } from '../../QueryEngine.js'
import { getTools } from '../../tools/index.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { parseSlashCommand, runReplSession } from '../repl.js'

describe('parseSlashCommand', () => {
  test('parses exit aliases', () => {
    expect(parseSlashCommand('/exit')).toEqual({ type: 'exit' })
    expect(parseSlashCommand('/quit')).toEqual({ type: 'exit' })
  })

  test('parses clear and help', () => {
    expect(parseSlashCommand('/clear')).toEqual({ type: 'clear' })
    expect(parseSlashCommand('/help')).toEqual({ type: 'help' })
  })

  test('returns null for normal prompts', () => {
    expect(parseSlashCommand('你好')).toBeNull()
    expect(parseSlashCommand('/unknown')).toBeNull()
  })
})

describe('runReplSession slash handling', () => {
  test('clear resets engine and does not send slash to model', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'ok' }])
        },
        uuid: () => 'slash-uuid',
      },
    })

    const printed: string[] = []
    let turnCount = 0

    async function* lines() {
      yield 'hello'
      yield '/clear'
      yield '/help'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      print: t => printed.push(t),
      consume: async gen => {
        turnCount++
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(turnCount).toBe(1)
    expect(engine.messages).toEqual([])
    expect(printed.some(p => p.includes('会话已清空'))).toBe(true)
    expect(printed.some(p => p.includes('/help'))).toBe(true)
  })
})
