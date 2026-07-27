import { describe, expect, test } from 'bun:test'
import type { McpSlashCommand } from '../types.js'
import {
  formatMcpHelpLines,
  parseMcpSlashCommand,
} from '../promptSlash.js'

const commands: McpSlashCommand[] = [
  {
    serverId: 'tour',
    promptName: 'plan_trip',
    internalName: 'mcp__tour__plan_trip',
    description: 'Plan a trip',
    argNames: ['city', 'days'],
    slashLabel: 'tour:plan_trip (MCP)',
    run: async () => [],
  },
]

describe('parseMcpSlashCommand', () => {
  test('parses MCP slash with (MCP) marker and args', () => {
    const parsed = parseMcpSlashCommand('/tour:plan_trip (MCP) Tokyo 3', commands)
    expect(parsed?.command.promptName).toBe('plan_trip')
    expect(parsed?.argsLine).toBe('Tokyo 3')
  })

  test('parses bare /server:prompt args without (MCP)', () => {
    const parsed = parseMcpSlashCommand('/tour:plan_trip 石家庄 2天', commands)
    expect(parsed?.command.promptName).toBe('plan_trip')
    expect(parsed?.argsLine).toBe('石家庄 2天')
  })

  test('returns null for unknown MCP slash', () => {
    expect(parseMcpSlashCommand('/missing:foo (MCP)', commands)).toBeNull()
    expect(parseMcpSlashCommand('/missing:foo args', commands)).toBeNull()
  })

  test('returns null for normal slash', () => {
    expect(parseMcpSlashCommand('/help', commands)).toBeNull()
  })
})

describe('formatMcpHelpLines', () => {
  test('includes slash labels', () => {
    const lines = formatMcpHelpLines(commands)
    expect(lines[0]).toContain('/tour:plan_trip (MCP)')
  })
})
