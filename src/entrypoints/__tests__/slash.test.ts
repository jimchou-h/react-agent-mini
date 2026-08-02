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

  test('parses compact', () => {
    expect(parseSlashCommand('/compact')).toEqual({ type: 'compact' })
  })

  test('parses memory', () => {
    expect(parseSlashCommand('/memory')).toEqual({ type: 'memory' })
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

  test('/compact rewrites session and prints before/after ctx', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'ok' }])
        },
        uuid: () => 'compact-uuid',
      },
    })

    const printed: string[] = []
    let turnCount = 0

    async function* lines() {
      yield '第一轮'
      yield '第二轮'
      yield '第三轮'
      yield '/compact'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      print: t => printed.push(t),
      summarizeForCompact: async () => '测试摘要',
      consume: async gen => {
        turnCount++
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(turnCount).toBe(3)
    expect(printed.some(p => p.includes('已压缩会话'))).toBe(true)
    expect(printed.some(p => p.includes('ctx ~'))).toBe(true)
    expect(
      engine.messages.some(
        m =>
          m.type === 'user' &&
          m.meta &&
          m.content.some(
            b => b.type === 'text' && b.text.includes('compact boundary'),
          ),
      ),
    ).toBe(true)
  })

  test('/compact failure leaves session unchanged', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'ok' }])
        },
        uuid: () => 'compact-fail',
      },
    })

    const printed: string[] = []
    async function* lines() {
      yield 'hello'
      yield '/compact'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      print: t => printed.push(t),
      summarizeForCompact: async () => {
        throw new Error('nope')
      },
      consume: async gen => {
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(printed.some(p => p.includes('压缩失败'))).toBe(true)
    expect(engine.messages.some(m => m.type === 'user')).toBe(true)
    expect(
      engine.messages.some(
        m =>
          m.type === 'user' &&
          m.meta &&
          m.content.some(
            b => b.type === 'text' && b.text.includes('compact boundary'),
          ),
      ),
    ).toBe(false)
  })

  test('MCP slash without @ mention does not auto-mount resources', async () => {
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

    let listed = 0
    const mcpClients = [
      {
        serverId: 'tour',
        capabilities: { resources: {} },
        client: {
          listResources: async () => {
            listed++
            return {
              resources: [
                { uri: 'docs://handbook', name: '差旅手册' },
                { uri: 'docs://other', name: 'other' },
              ],
            }
          },
          readResource: async () => ({
            contents: [{ uri: 'docs://handbook', text: 'should-not-mount' }],
          }),
        },
        close: async () => {},
      },
    ] as unknown as import('../../services/mcp/types.js').McpConnectedClient[]

    const printed: string[] = []

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
        while (true) {
          const result = await gen.next()
          if (result.done) return result.value
        }
      },
    })

    expect(listed).toBe(0)
    expect(printed.some(p => p.includes('已挂载 MCP Resource'))).toBe(false)
    const texts = engine.messages
      .filter(m => m.type === 'user')
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
    expect(texts.some(t => t.includes('should-not-mount'))).toBe(false)
    expect(texts.some(t => t.includes('injected:Tokyo'))).toBe(true)
  })

  test('MCP slash with @server:uri mounts only referenced resource', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'done' }])
        },
        uuid: () => 'mcp-slash-ref-uuid',
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
        run: async argsLine => {
          const msg = createUserMessage(
            `injected:${argsLine}\n要求：先阅读 @tour:docs://handbook ，再给出日程草案。`,
          )
          msg.meta = true
          return [msg]
        },
      },
    ]

    const reads: string[] = []
    const mcpClients = [
      {
        serverId: 'tour',
        capabilities: { resources: {} },
        client: {
          listResources: async () => ({
            resources: [
              { uri: 'docs://handbook', name: '差旅手册' },
              { uri: 'docs://other', name: 'other' },
            ],
          }),
          readResource: async (params: { uri: string }) => {
            reads.push(params.uri)
            return {
              contents: [
                {
                  uri: params.uri,
                  text:
                    params.uri === 'docs://handbook'
                      ? '# 差旅手册\n经济舱优先'
                      : 'other-body',
                },
              ],
            }
          },
        },
        close: async () => {},
      },
    ] as unknown as import('../../services/mcp/types.js').McpConnectedClient[]

    const printed: string[] = []

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
        while (true) {
          const result = await gen.next()
          if (result.done) return result.value
        }
      },
    })

    expect(reads).toEqual(['docs://handbook'])
    expect(printed.some(p => p.includes('已挂载 MCP Resource ×1'))).toBe(true)
    const texts = engine.messages
      .filter(m => m.type === 'user')
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
    expect(texts.some(t => t.includes('经济舱优先'))).toBe(true)
    expect(texts.some(t => t.includes('other-body'))).toBe(false)
    expect(texts.some(t => t.includes('@tour:docs://handbook'))).toBe(true)
  })

  test('ordinary message with @server:uri mounts resource before user text', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'done' }])
        },
        uuid: () => 'ordinary-mention-uuid',
      },
    })

    const reads: string[] = []
    const mcpClients = [
      {
        serverId: 'tour',
        capabilities: { resources: {} },
        client: {
          listResources: async () => ({
            resources: [{ uri: 'docs://handbook', name: '差旅手册' }],
          }),
          readResource: async (params: { uri: string }) => {
            reads.push(params.uri)
            return {
              contents: [
                {
                  uri: params.uri,
                  text: '# 差旅手册\n经济舱优先',
                },
              ],
            }
          },
        },
        close: async () => {},
      },
    ] as unknown as import('../../services/mcp/types.js').McpConnectedClient[]

    const printed: string[] = []

    async function* lines() {
      yield '请根据 @tour:docs://handbook 安排行程'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      mcpClients,
      print: t => printed.push(t),
      consume: async gen => {
        while (true) {
          const result = await gen.next()
          if (result.done) return result.value
        }
      },
    })

    expect(reads).toEqual(['docs://handbook'])
    expect(printed.some(p => p.includes('已挂载 MCP Resource ×1'))).toBe(true)
    const userTexts = engine.messages
      .filter(m => m.type === 'user')
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
    expect(userTexts[0]).toContain('经济舱优先')
    expect(userTexts.some(t => t.includes('请根据 @tour:docs://handbook 安排行程'))).toBe(
      true,
    )
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
    expect(text).toContain('/compact')
    expect(text).toContain('/memory')
  })

  test('includes Skill slash section', () => {
    const text = buildHelpText([], [
      {
        name: 'echo-demo',
        description: 'Echo workflow',
        body: '# x',
        path: '/tmp/echo-demo/SKILL.md',
      },
    ])
    expect(text).toContain('Skills:')
    expect(text).toContain('/echo-demo — Echo workflow')
  })
})

describe('runReplSession /memory', () => {
  test('prints path and length without callModel', async () => {
    const { mkdir, mkdtemp, rm, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { loadAgentMemorySnapshot } = await import(
      '../../services/memory/load.js'
    )

    const rootDir = await mkdtemp(join(tmpdir(), 'repl-memory-'))
    try {
      const dir = join(rootDir, '.agents', 'memory')
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, 'MEMORY.md'), 'prefer tabs', 'utf-8')
      const snapshot = await loadAgentMemorySnapshot(rootDir)

      const tools = getTools()
      const engine = new QueryEngine({
        tools,
        toolUseContext: createMinimalToolContext(tools),
        memoryRefresh: {
          cwd: rootDir,
          projectContext: undefined,
          skills: [],
          snapshot,
        },
        deps: {
          callModel: async function* mock() {
            yield createAssistantMessage([
              { type: 'text', text: 'should-not-run' },
            ])
          },
          uuid: () => 'memory-slash',
        },
      })

      const printed: string[] = []
      let turnCount = 0

      async function* lines() {
        yield '/memory'
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

      expect(turnCount).toBe(0)
      expect(printed.some(p => p.includes('MEMORY.md'))).toBe(true)
      expect(printed.some(p => p.includes('11 chars'))).toBe(true)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})

describe('runReplSession Skill slash', () => {
  const echoSkill = {
    name: 'echo-demo',
    description: 'Demo skill',
    body: '# Echo demo\nDo the thing.',
    path: '/workspace/.agents/skills/echo-demo/SKILL.md',
  }

  test('/echo-demo loads skill without callModel', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'should-not-run' }])
        },
        uuid: () => 'skill-slash-uuid',
      },
    })

    const printed: string[] = []
    let turnCount = 0

    async function* lines() {
      yield '/echo-demo'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      skills: [echoSkill],
      print: t => printed.push(t),
      consume: async gen => {
        turnCount++
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(turnCount).toBe(0)
    expect(printed.some(p => p.includes('已加载 skill: echo-demo'))).toBe(true)
    expect(engine.messages).toHaveLength(1)
    const text = engine.messages[0]!
    expect(text.type).toBe('user')
    if (text.type === 'user') {
      const block = text.content[0]
      expect(block?.type).toBe('text')
      if (block?.type === 'text') {
        expect(block.text).toContain('Base directory for this skill:')
        expect(block.text).toContain('# Echo demo')
        expect(block.text).toContain('Do the thing.')
      }
    }
  })

  test('skill slash with args injects then runTurn(args)', async () => {
    const tools = getTools()
    const seenUser: string[] = []
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock(params) {
          for (const m of params.messages) {
            if (m.type !== 'user') continue
            for (const b of m.content) {
              if (b.type === 'text') seenUser.push(b.text)
            }
          }
          yield createAssistantMessage([{ type: 'text', text: 'ok' }])
        },
        uuid: () => 'skill-args-uuid',
      },
    })

    let turnCount = 0
    async function* lines() {
      yield '/echo-demo 帮我写一个 foo'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      skills: [echoSkill],
      print: () => {},
      consume: async gen => {
        turnCount++
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(turnCount).toBe(1)
    // 注入在前、args userText 在后；整段历史都会进 callModel
    const joined = seenUser.join('\n')
    expect(joined).toContain('Arguments: 帮我写一个 foo')
    expect(joined).toContain('帮我写一个 foo')
    expect(engine.messages.some(m => {
      if (m.type !== 'user') return false
      return m.content.some(
        b => b.type === 'text' && b.text === '帮我写一个 foo',
      )
    })).toBe(true)
  })

  test('builtin /help wins over skill named help', async () => {
    const tools = getTools()
    const engine = new QueryEngine({
      tools,
      toolUseContext: createMinimalToolContext(tools),
      deps: {
        callModel: async function* mock() {
          yield createAssistantMessage([{ type: 'text', text: 'no' }])
        },
        uuid: () => 'help-priority-uuid',
      },
    })

    const printed: string[] = []
    let turnCount = 0
    async function* lines() {
      yield '/help'
      yield '/exit'
    }

    await runReplSession({
      engine,
      lines: lines(),
      skills: [
        {
          name: 'help',
          body: '# fake help skill',
          path: '/tmp/help/SKILL.md',
        },
        echoSkill,
      ],
      print: t => printed.push(t),
      consume: async gen => {
        turnCount++
        while (true) {
          const { done, value } = await gen.next()
          if (done) return value
        }
      },
    })

    expect(turnCount).toBe(0)
    expect(printed.some(p => p.includes('可用命令'))).toBe(true)
    expect(printed.some(p => p.includes('已加载 skill'))).toBe(false)
    expect(engine.messages).toEqual([])
  })
})
