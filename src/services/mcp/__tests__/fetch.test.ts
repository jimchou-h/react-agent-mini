import { describe, expect, test } from 'bun:test'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  extractMcpResourceMentions,
  fetchCommandsForClient,
  fetchResourcesForClient,
  loadReferencedResourcesAsMetaMessages,
  loadServerResourcesAsMetaMessages,
  promptMessagesToUserMessages,
  readMcpResource,
  resolvePromptResourceMessages,
} from '../fetch.js'
import { createUserMessage } from '../../../utils/messages.js'
import type { McpConnectedClient } from '../types.js'

function mockClient(partial: {
  capabilities?: McpConnectedClient['capabilities']
  listResources?: () => Promise<unknown>
  listPrompts?: () => Promise<unknown>
  getPrompt?: (params: { arguments?: Record<string, string> }) => Promise<unknown>
  readResource?: () => Promise<unknown>
}): McpConnectedClient {
  return {
    serverId: 'demo',
    capabilities: partial.capabilities,
    client: {
      listResources: partial.listResources ?? (async () => ({ resources: [] })),
      listPrompts: partial.listPrompts ?? (async () => ({ prompts: [] })),
      getPrompt: partial.getPrompt ?? (async () => ({ messages: [] })),
      readResource: partial.readResource ?? (async () => ({ contents: [] })),
    } as unknown as Client,
    close: async () => {},
  }
}

describe('fetchResourcesForClient', () => {
  test('returns [] when server has no resources capability', async () => {
    const client = mockClient({ capabilities: { tools: {} } })
    await expect(fetchResourcesForClient(client)).resolves.toEqual([])
  })

  test('returns resources with server field', async () => {
    const client = mockClient({
      capabilities: { resources: {} },
      listResources: async () => ({
        resources: [
          {
            uri: 'docs://handbook',
            name: 'handbook',
            mimeType: 'text/markdown',
          },
        ],
      }),
    })
    await expect(fetchResourcesForClient(client)).resolves.toEqual([
      {
        uri: 'docs://handbook',
        name: 'handbook',
        mimeType: 'text/markdown',
        server: 'demo',
      },
    ])
  })

  test('fail-soft on list error', async () => {
    const warnings: string[] = []
    const client = mockClient({
      capabilities: { resources: {} },
      listResources: async () => {
        throw new Error('boom')
      },
    })
    await expect(
      fetchResourcesForClient(client, { warn: msg => warnings.push(msg) }),
    ).resolves.toEqual([])
    expect(warnings.length).toBe(1)
  })
})

describe('fetchCommandsForClient', () => {
  test('returns [] when server has no prompts capability', async () => {
    const client = mockClient({ capabilities: { tools: {} } })
    await expect(fetchCommandsForClient(client)).resolves.toEqual([])
  })

  test('maps prompts to slash commands', async () => {
    const client = mockClient({
      capabilities: { prompts: {} },
      listPrompts: async () => ({
        prompts: [
          {
            name: 'plan_trip',
            description: 'Plan a trip',
            arguments: [
              { name: 'city', required: true },
              { name: 'days', required: true },
            ],
          },
        ],
      }),
      getPrompt: async (params: { arguments?: Record<string, string> }) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `City=${params.arguments?.city}`,
            },
          },
        ],
      }),
    })

    const commands = await fetchCommandsForClient(client)
    expect(commands).toHaveLength(1)
    expect(commands[0]?.slashLabel).toBe('demo:plan_trip (MCP)')
    expect(commands[0]?.internalName).toBe('mcp__demo__plan_trip')

    const injected = await commands[0]!.run('Tokyo 3')
    expect(injected[0]?.meta).toBe(true)
    expect(injected[0]?.content[0]).toEqual({
      type: 'text',
      text: 'City=Tokyo',
    })
  })
})

describe('readMcpResource', () => {
  test('throws when resources unsupported', async () => {
    const client = mockClient({ capabilities: { tools: {} } })
    await expect(readMcpResource(client, 'docs://x')).rejects.toThrow(
      'does not support resources',
    )
  })

  test('returns text contents', async () => {
    const client = mockClient({
      capabilities: { resources: {} },
      readResource: async () => ({
        contents: [{ uri: 'docs://x', mimeType: 'text/plain', text: 'hello' }],
      }),
    })
    await expect(readMcpResource(client, 'docs://x')).resolves.toEqual([
      { uri: 'docs://x', mimeType: 'text/plain', text: 'hello' },
    ])
  })
})

describe('loadServerResourcesAsMetaMessages', () => {
  test('reads listed resources into meta messages', async () => {
    const client = mockClient({
      capabilities: { resources: {} },
      listResources: async () => ({
        resources: [{ uri: 'docs://handbook', name: 'handbook' }],
      }),
      readResource: async () => ({
        contents: [{ uri: 'docs://handbook', text: 'policy body' }],
      }),
    })
    const messages = await loadServerResourcesAsMetaMessages([client], 'demo')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.meta).toBe(true)
    const text =
      messages[0]?.content[0]?.type === 'text'
        ? messages[0].content[0].text
        : ''
    expect(text).toContain('policy body')
    expect(text).toContain('docs://handbook')
  })
})

describe('extractMcpResourceMentions', () => {
  test('parses @server:uri including :// in uri', () => {
    expect(
      extractMcpResourceMentions(
        '先阅读 @tour:docs://handbook ，再给出日程草案。',
      ),
    ).toEqual([{ server: 'tour', uri: 'docs://handbook' }])
  })

  test('dedupes and ignores non-mention at-signs', () => {
    expect(
      extractMcpResourceMentions(
        'email@x.com @tour:docs://a @tour:docs://a @other:res://b',
      ),
    ).toEqual([
      { server: 'tour', uri: 'docs://a' },
      { server: 'other', uri: 'res://b' },
    ])
  })
})

describe('loadReferencedResourcesAsMetaMessages', () => {
  test('reads only referenced uris', async () => {
    const reads: string[] = []
    const client = mockClient({
      capabilities: { resources: {} },
      readResource: async () => {
        reads.push('docs://handbook')
        return {
          contents: [{ uri: 'docs://handbook', text: 'handbook body' }],
        }
      },
    })
    // override serverId after mock (mockClient hardcodes demo)
    const tourClient = { ...client, serverId: 'tour' }
    tourClient.client = {
      ...client.client,
      readResource: async (params: { uri: string }) => {
        reads.push(params.uri)
        return {
          contents: [{ uri: params.uri, text: `body:${params.uri}` }],
        }
      },
    } as unknown as typeof client.client

    const messages = await loadReferencedResourcesAsMetaMessages(
      [tourClient],
      [{ server: 'tour', uri: 'docs://handbook' }],
    )
    expect(reads).toEqual(['docs://handbook'])
    expect(messages).toHaveLength(1)
    const text =
      messages[0]?.content[0]?.type === 'text'
        ? messages[0].content[0].text
        : ''
    expect(text).toContain('body:docs://handbook')
    expect(text).toContain('server=tour')
  })

  test('warns and skips missing server without aborting', async () => {
    const warnings: string[] = []
    const messages = await loadReferencedResourcesAsMetaMessages(
      [],
      [{ server: 'missing', uri: 'docs://x' }],
      { warn: msg => warnings.push(msg) },
    )
    expect(messages).toEqual([])
    expect(warnings.length).toBe(1)
  })
})

describe('resolvePromptResourceMessages', () => {
  test('by-ref when prompt text has @server:uri (no full mount)', async () => {
    let listed = 0
    const reads: string[] = []
    const tourClient = {
      serverId: 'tour',
      capabilities: { resources: {} },
      client: {
        listResources: async () => {
          listed++
          return {
            resources: [
              { uri: 'docs://handbook', name: 'handbook' },
              { uri: 'docs://other', name: 'other' },
            ],
          }
        },
        readResource: async (params: { uri: string }) => {
          reads.push(params.uri)
          return {
            contents: [{ uri: params.uri, text: `body:${params.uri}` }],
          }
        },
      },
      close: async () => {},
    } as unknown as import('../types.js').McpConnectedClient

    const prompt = createUserMessage(
      '要求：先阅读 @tour:docs://handbook ，再给出日程草案。',
    )
    prompt.meta = true

    const messages = await resolvePromptResourceMessages(
      [tourClient],
      'tour',
      [prompt],
    )
    expect(listed).toBe(0)
    expect(reads).toEqual(['docs://handbook'])
    expect(messages).toHaveLength(1)
    expect(
      messages[0]?.content[0]?.type === 'text'
        ? messages[0].content[0].text
        : '',
    ).toContain('body:docs://handbook')
  })

  test('fallback full mount when prompt has no @server:uri', async () => {
    const tourClient = {
      serverId: 'tour',
      capabilities: { resources: {} },
      client: {
        listResources: async () => ({
          resources: [
            { uri: 'docs://handbook', name: 'handbook' },
            { uri: 'docs://other', name: 'other' },
          ],
        }),
        readResource: async (params: { uri: string }) => ({
          contents: [{ uri: params.uri, text: `body:${params.uri}` }],
        }),
      },
      close: async () => {},
    } as unknown as import('../types.js').McpConnectedClient

    const prompt = createUserMessage('先阅读差旅手册（若已挂载）')
    prompt.meta = true

    const messages = await resolvePromptResourceMessages(
      [tourClient],
      'tour',
      [prompt],
    )
    expect(messages).toHaveLength(2)
  })
})

describe('promptMessagesToUserMessages', () => {
  test('marks messages as meta', () => {
    const messages = promptMessagesToUserMessages([
      {
        role: 'user',
        content: { type: 'text', text: 'prompt body' },
      },
    ])
    expect(messages[0]?.meta).toBe(true)
  })
})
