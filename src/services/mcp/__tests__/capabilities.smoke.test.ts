import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import { runToolUse } from '../../tools/execution.js'
import {
  LIST_MCP_RESOURCES_TOOL_NAME,
  READ_MCP_RESOURCE_TOOL_NAME,
} from '../../../tools/McpResourceTools.js'
import { createAssistantMessage } from '../../../utils/messages.js'
import type { ToolUseBlock } from '../../../types/message.js'
import { loadMcpTools, sessionTools } from '../load.js'

describe('MCP tour server capabilities smoke', () => {
  let testDir: string
  let originalCwd: string
  const prevConfig = process.env.MCP_CONFIG

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'mcp-tour-cap-'))
    process.chdir(testDir)
    delete process.env.MCP_CONFIG

    const serverPath = join(import.meta.dir, '../../../../examples/mcp-tour-server/server.js')
    await writeFile(
      join(testDir, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          tour: {
            command: 'node',
            args: [serverPath],
          },
        },
      }),
      'utf-8',
    )
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    if (prevConfig === undefined) delete process.env.MCP_CONFIG
    else process.env.MCP_CONFIG = prevConfig
  })

  test('loads resources tools, commands, and can list/read resource', async () => {
    const loaded = await loadMcpTools({ cwd: testDir })
    try {
      expect(loaded.hasResources).toBe(true)
      expect(loaded.commands.some(cmd => cmd.slashLabel === 'tour:plan_trip (MCP)')).toBe(
        true,
      )

      const tools = sessionTools(loaded)
      expect(tools.some(tool => tool.name === LIST_MCP_RESOURCES_TOOL_NAME)).toBe(true)
      expect(tools.some(tool => tool.name === READ_MCP_RESOURCE_TOOL_NAME)).toBe(true)

      const listBlock: ToolUseBlock = {
        type: 'tool_use',
        id: 'toolu_list_res',
        name: LIST_MCP_RESOURCES_TOOL_NAME,
        input: {},
      }
      const listUpdate = await runToolUse(listBlock, createAssistantMessage([listBlock]), {
        ...createMinimalToolContext(tools),
        mcpClients: loaded.clients,
      })
      const listResult = listUpdate.message.content[0]
      expect(listResult.type).toBe('tool_result')
      if (listResult.type === 'tool_result') {
        expect(listResult.content).toContain('docs://handbook')
      }

      const readBlock: ToolUseBlock = {
        type: 'tool_use',
        id: 'toolu_read_res',
        name: READ_MCP_RESOURCE_TOOL_NAME,
        input: { server: 'tour', uri: 'docs://handbook' },
      }
      const readUpdate = await runToolUse(readBlock, createAssistantMessage([readBlock]), {
        ...createMinimalToolContext(tools),
        mcpClients: loaded.clients,
      })
      const readResult = readUpdate.message.content[0]
      expect(readResult.type).toBe('tool_result')
      if (readResult.type === 'tool_result') {
        expect(readResult.content).toContain('差旅手册')
      }

      const injected = await loaded.commands[0]!.run('Paris 2')
      expect(injected[0]?.meta).toBe(true)
      expect(injected[0]?.content[0]).toMatchObject({
        type: 'text',
      })
    } finally {
      await loaded.close()
    }
  }, 30_000)
})
