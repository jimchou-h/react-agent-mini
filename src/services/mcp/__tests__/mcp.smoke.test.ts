import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHeadlessCanUseTool } from '../../../permissions/canUseTool.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import { getTools } from '../../../tools/index.js'
import type { ToolUseBlock } from '../../../types/message.js'
import { createAssistantMessage } from '../../../utils/messages.js'
import { runToolUse } from '../../tools/execution.js'
import { adaptMcpTool } from '../adapter.js'
import { loadMcpTools, sessionTools } from '../load.js'

describe('MCP session smoke', () => {
  test('adapted MCP tool runs through runToolUse when allowed', async () => {
    const mcpTool = adaptMcpTool(
      'fixture',
      {
        name: 'ping',
        description: 'ping',
        inputSchema: {
          type: 'object',
          properties: { x: { type: 'string' } },
        },
      },
      async (_name, args) => ({
        content: [{ type: 'text', text: `pong:${args.x}` }],
      }),
    )

    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_mcp_1',
      name: mcpTool.name,
      input: { x: 'ok' },
    }
    const parent = createAssistantMessage([block])
    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([mcpTool]),
      canUseTool: async () => ({ behavior: 'allow' }),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
      expect(result.content).toBe('pong:ok')
    }
  })

  test('headless denies non-readonly MCP tools without ALLOW_WRITE', async () => {
    const prev = process.env.ALLOW_WRITE
    delete process.env.ALLOW_WRITE
    try {
      const mcpTool = adaptMcpTool(
        'fixture',
        { name: 'writeish' },
        async () => {
          throw new Error('should not be called')
        },
      )
      const block: ToolUseBlock = {
        type: 'tool_use',
        id: 'toolu_mcp_deny',
        name: mcpTool.name,
        input: {},
      }
      const parent = createAssistantMessage([block])
      const update = await runToolUse(block, parent, {
        ...createMinimalToolContext([mcpTool]),
        canUseTool: createHeadlessCanUseTool(),
      })
      const result = update.message.content[0]
      expect(result.type).toBe('tool_result')
      if (result.type === 'tool_result') {
        expect(result.is_error).toBe(true)
        expect(result.content).toContain('ALLOW_WRITE')
      }
    } finally {
      if (prev === undefined) delete process.env.ALLOW_WRITE
      else process.env.ALLOW_WRITE = prev
    }
  })

  test('sessionTools without MCP equals builtin getTools', () => {
    expect(sessionTools([]).map(t => t.name)).toEqual(
      getTools().map(t => t.name),
    )
  })
})

describe('loadMcpTools', () => {
  let testDir: string
  let originalCwd: string
  const prevConfig = process.env.MCP_CONFIG

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'mcp-load-'))
    process.chdir(testDir)
    delete process.env.MCP_CONFIG
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
    if (prevConfig === undefined) delete process.env.MCP_CONFIG
    else process.env.MCP_CONFIG = prevConfig
  })

  test('returns empty tools when no .mcp.json', async () => {
    const loaded = await loadMcpTools({ cwd: testDir })
    expect(loaded.tools).toEqual([])
    await loaded.close()
  })
})
