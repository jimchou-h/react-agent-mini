import { describe, expect, test } from 'bun:test'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import {
  LIST_MCP_RESOURCES_TOOL_NAME,
  ListMcpResourcesTool,
  READ_MCP_RESOURCE_TOOL_NAME,
  ReadMcpResourceTool,
} from '../McpResourceTools.js'
import type { McpConnectedClient } from '../../services/mcp/types.js'

function mockClient(partial: Partial<McpConnectedClient> & { serverId: string }): McpConnectedClient {
  return {
    capabilities: partial.capabilities,
    client: partial.client as McpConnectedClient['client'],
    close: partial.close ?? (async () => {}),
    serverId: partial.serverId,
  }
}

describe('ListMcpResourcesTool', () => {
  test('lists resources from connected clients', async () => {
    const client = mockClient({
      serverId: 'tour',
      capabilities: { resources: {} },
      client: {
        listResources: async () => ({
          resources: [{ uri: 'docs://handbook', name: 'handbook' }],
        }),
      } as McpConnectedClient['client'],
    })

    const result = await ListMcpResourcesTool.call({}, {
      ...createMinimalToolContext(),
      mcpClients: [client],
    })

    expect(typeof result.data).toBe('string')
    expect(String(result.data)).toContain('docs://handbook')
  })

  test('errors when filtered server missing', async () => {
    await expect(
      ListMcpResourcesTool.call({ server: 'missing' }, {
        ...createMinimalToolContext(),
        mcpClients: [],
      }),
    ).rejects.toThrow('Server "missing" not found')
  })
})

describe('ReadMcpResourceTool', () => {
  test('reads resource text', async () => {
    const client = mockClient({
      serverId: 'tour',
      capabilities: { resources: {} },
      client: {
        readResource: async () => ({
          contents: [{ uri: 'docs://handbook', text: 'policy text' }],
        }),
      } as unknown as McpConnectedClient['client'],
    })

    const result = await ReadMcpResourceTool.call(
      { server: 'tour', uri: 'docs://handbook' },
      {
        ...createMinimalToolContext(),
        mcpClients: [client],
      },
    )

    expect(result.data).toBe('policy text')
  })

  test('errors when server lacks resources capability', async () => {
    const client = mockClient({
      serverId: 'tour',
      capabilities: { tools: {} },
      client: {} as McpConnectedClient['client'],
    })

    await expect(
      ReadMcpResourceTool.call(
        { server: 'tour', uri: 'docs://handbook' },
        {
          ...createMinimalToolContext(),
          mcpClients: [client],
        },
      ),
    ).rejects.toThrow('does not support resources')
  })
})

describe('tool names', () => {
  test('matches claude-code public names', () => {
    expect(LIST_MCP_RESOURCES_TOOL_NAME).toBe('ListMcpResourcesTool')
    expect(READ_MCP_RESOURCE_TOOL_NAME).toBe('ReadMcpResourceTool')
  })
})
