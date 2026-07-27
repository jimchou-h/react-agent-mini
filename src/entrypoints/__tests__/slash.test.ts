import { describe, expect, test } from 'bun:test'
import { QueryEngine } from '../../QueryEngine.js'
import { getTools } from '../../tools/index.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createAssistantMessage, createUserMessage } from '../../utils/messages.js'
import type { McpSlashCommand } from '../../services/mcp/types.js'
import {
  buildHelpText,
  parseSlashCommand,
  runReplSession,
} from '../repl.js'

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

  test('MCP slash injects resources then prompt meta messages', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'done' }])
        },
        uuid: () => 'mcp-slash-uuid',
      },
    })

    const mcpCommands: McpSlashCommand[] = [
      {
        serverId: 'tour',
        promptName: 'plan_trip',
        internalName: 'mcp__tour__plan_trip',
        description: 'Plan trip',
        argNames: ['city'],
        slashLabel: 'tour:plan_trip (MCP)',
        run: async argsLine => [
          createUserMessage(`injected:${argsLine}`),
        ],
      },
    ]

    const mcpClients = [
      {
        serverId: 'tour',
        capabilities: { resources: {} },
        client: {
          listResources: async () => ({
            resources: [{ uri: 'docs://handbook', name: '差旅手册' }],
          }),
          readResource: async () => ({
            contents: [
              {
                uri: 'docs://handbook',
                text: '# 差旅手册\n经济舱优先',
              },
            ],
          }),
        },
        close: async () => {},
      },
    ] as unknown as import('../../services/mcp/types.js').McpConnectedClient[]

    const printed: string[] = []
    let turnCount = 0

    async function* lines() {
      yield '/tour:plan_trip Tokyo'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      mcpCommands,
      mcpClients,
      print: t => printed.push(t),
      consume: async gen => {
        turnCount++
        while (true) {
          const result = await gen.next()
          if (result.done) return result.value
        }
      },
    })

    expect(turnCount).toBe(1)
    expect(printed.some(p => p.includes('已挂载 MCP Resource'))).toBe(true)
    const texts = engine.messages
      .filter(m => m.type === 'user')
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
    expect(texts.some(t => t.includes('差旅手册') && t.includes('经济舱优先'))).toBe(
      true,
    )
    expect(texts.some(t => t.includes('injected:Tokyo'))).toBe(true)
  })
})

describe('buildHelpText', () => {
  test('includes MCP slash commands', () => {
    const text = buildHelpText([
      {
        serverId: 'tour',
        promptName: 'plan_trip',
        internalName: 'mcp__tour__plan_trip',
        description: 'Plan trip',
        argNames: [],
        slashLabel: 'tour:plan_trip (MCP)',
        run: async () => [],
      },
    ])
    expect(text).toContain('tour:plan_trip (MCP)')
  })
})
