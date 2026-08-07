import { describe, expect, test } from 'bun:test'
import {
  filterSlashSuggestions,
  listSlashSuggestions,
} from '../slashSuggestions.js'

describe('slashSuggestions', () => {
  test('lists builtins and filters /he → /help', () => {
    const all = listSlashSuggestions(
      [
        {
          serverId: 'demo',
          promptName: 'greet',
          internalName: 'mcp__demo__greet',
          description: 'hi',
          argNames: [],
          slashLabel: 'demo:greet (MCP)',
          run: async () => [],
        },
      ],
      [{ name: 'echo-demo', description: 'echo', path: '/x', body: '' }],
    )
    expect(all.some(s => s.command === '/help' && s.source === 'builtin')).toBe(
      true,
    )
    expect(all.some(s => s.command === '/demo:greet')).toBe(true)
    expect(all.some(s => s.command === '/echo-demo')).toBe(true)
    const filtered = filterSlashSuggestions('/he', all)
    expect(filtered.map(s => s.command)).toContain('/help')
  })

  test('non-slash prefix yields no suggestions', () => {
    expect(filterSlashSuggestions('help', listSlashSuggestions())).toEqual([])
  })
})
