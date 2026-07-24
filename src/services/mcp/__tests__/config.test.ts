import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadMcpConfig,
  resolveMcpConfigPath,
  resolveMcpConfigPaths,
} from '../config.js'

describe('loadMcpConfig', () => {
  let testDir: string
  let originalCwd: string
  const prevConfig = process.env.MCP_CONFIG

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'mcp-config-'))
    process.chdir(testDir)
    delete process.env.MCP_CONFIG
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
    if (prevConfig === undefined) delete process.env.MCP_CONFIG
    else process.env.MCP_CONFIG = prevConfig
  })

  test('returns undefined when .mcp.json is missing', async () => {
    expect(await loadMcpConfig(testDir)).toBeUndefined()
  })

  test('loads a valid mcpServers config', async () => {
    await writeFile(
      join(testDir, '.mcp.json'),
      JSON.stringify({
        mcpServers: {
          demo: {
            command: 'npx',
            args: ['-y', 'some-server'],
          },
        },
      }),
      'utf-8',
    )

    const config = await loadMcpConfig(testDir)
    expect(config).toEqual({
      mcpServers: {
        demo: {
          command: 'npx',
          args: ['-y', 'some-server'],
        },
      },
    })
  })

  test('throws on invalid JSON', async () => {
    await writeFile(join(testDir, '.mcp.json'), '{not-json', 'utf-8')
    await expect(loadMcpConfig(testDir)).rejects.toThrow('JSON 无效')
  })

  test('throws on invalid structure', async () => {
    await writeFile(
      join(testDir, '.mcp.json'),
      JSON.stringify({ mcpServers: { bad: { args: [] } } }),
      'utf-8',
    )
    await expect(loadMcpConfig(testDir)).rejects.toThrow('command')
  })

  test('MCP_CONFIG overrides the default path', async () => {
    const custom = join(testDir, 'custom-mcp.json')
    await writeFile(
      custom,
      JSON.stringify({
        mcpServers: {
          alt: { command: 'node', args: ['server.js'] },
        },
      }),
      'utf-8',
    )
    process.env.MCP_CONFIG = custom

    expect(resolveMcpConfigPath(testDir)).toBe(custom)
    const config = await loadMcpConfig(testDir)
    expect(config?.mcpServers.alt?.command).toBe('node')
  })

  test('MCP_CONFIG comma-separated paths merge servers', async () => {
    const a = join(testDir, 'a.json')
    const b = join(testDir, 'b.json')
    await writeFile(
      a,
      JSON.stringify({
        mcpServers: {
          one: { command: 'node', args: ['one.js'] },
          shared: { command: 'node', args: ['from-a.js'] },
        },
      }),
      'utf-8',
    )
    await writeFile(
      b,
      JSON.stringify({
        mcpServers: {
          two: { command: 'node', args: ['two.js'] },
          shared: { command: 'node', args: ['from-b.js'] },
        },
      }),
      'utf-8',
    )
    process.env.MCP_CONFIG = `${a},${b}`

    expect(resolveMcpConfigPaths(testDir)).toEqual([a, b])
    const config = await loadMcpConfig(testDir)
    expect(config?.mcpServers).toEqual({
      one: { command: 'node', args: ['one.js'] },
      shared: { command: 'node', args: ['from-b.js'] },
      two: { command: 'node', args: ['two.js'] },
    })
  })
})
