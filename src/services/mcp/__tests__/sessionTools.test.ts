import { describe, expect, test } from 'bun:test'
import { getTools } from '../../../tools/index.js'
import { getMcpResourceTools } from '../../../tools/McpResourceTools.js'
import { sessionTools } from '../load.js'

describe('sessionTools resource injection', () => {
  test('without resources matches builtin + mcp tools only', () => {
    const merged = sessionTools({
      tools: [],
      clients: [],
      commands: [],
      hasResources: false,
      close: async () => {},
    })
    expect(merged.map(t => t.name)).toEqual(getTools().map(t => t.name))
  })

  test('with resources appends List/Read MCP resource tools once', () => {
    const merged = sessionTools({
      tools: [],
      clients: [],
      commands: [],
      hasResources: true,
      close: async () => {},
    })
    const resourceNames = getMcpResourceTools().map(t => t.name)
    expect(merged.map(t => t.name).slice(-2)).toEqual(resourceNames)
  })
})
