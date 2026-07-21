import { describe, expect, test } from 'bun:test'
import {
  adaptMcpTool,
  mcpPublicToolName,
} from '../adapter.js'
import { mergeTools } from '../client.js'
import { EchoTool } from '../../../tools/EchoTool.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'

describe('adaptMcpTool', () => {
  test('builds a prefixed public tool name', () => {
    expect(mcpPublicToolName('demo', 'foo')).toBe('mcp__demo__foo')
  })

  test('forwards call arguments and formats text content', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = []
    const tool = adaptMcpTool(
      'demo',
      {
        name: 'echo',
        description: 'echo tool',
        inputSchema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
      },
      async (name, args) => {
        calls.push({ name, args })
        return {
          content: [{ type: 'text', text: `got:${args.message}` }],
        }
      },
    )

    expect(tool.name).toBe('mcp__demo__echo')
    expect(tool.isReadOnly({})).toBe(false)
    expect(tool.inputJsonSchema).toMatchObject({
      type: 'object',
      properties: { message: { type: 'string' } },
    })

    const result = await tool.call(
      { message: 'hi' },
      createMinimalToolContext([tool]),
    )
    expect(calls).toEqual([{ name: 'echo', args: { message: 'hi' } }])
    expect(result.data).toBe('got:hi')
  })

  test('maps call failures to thrown errors for runToolUse', async () => {
    const tool = adaptMcpTool('demo', { name: 'boom' }, async () => {
      throw new Error('server down')
    })

    await expect(
      tool.call({}, createMinimalToolContext([tool])),
    ).rejects.toThrow('MCP 调用失败')
  })

  test('honors readOnlyHint annotation', () => {
    const tool = adaptMcpTool(
      'demo',
      { name: 'peek', annotations: { readOnlyHint: true } },
      async () => ({ content: [] }),
    )
    expect(tool.isReadOnly({})).toBe(true)
  })
})

describe('mergeTools', () => {
  test('keeps builtin names and appends prefixed mcp tools', () => {
    const mcp = adaptMcpTool('demo', { name: 'Echo' }, async () => ({
      content: [{ type: 'text', text: 'from-mcp' }],
    }))
    const merged = mergeTools([EchoTool], [mcp])
    expect(merged.map(t => t.name)).toEqual(['Echo', 'mcp__demo__Echo'])
  })
})
