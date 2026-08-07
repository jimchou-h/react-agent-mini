import type { DiscoveredSkill } from '../skills/discover.js'
import type { McpSlashCommand } from '../services/mcp/types.js'

const BUILTIN = [
  '/exit',
  '/quit',
  '/clear',
  '/help',
  '/compact',
  '/memory',
  '/status',
  '/init',
] as const

export type SlashSuggestion = {
  command: string
  source: 'builtin' | 'mcp' | 'skill'
  description?: string
}

/** Build slash suggestions from host registries (not a hardcoded fake list). */
export function listSlashSuggestions(
  mcpCommands: readonly McpSlashCommand[] = [],
  skills: readonly DiscoveredSkill[] = [],
): SlashSuggestion[] {
  const out: SlashSuggestion[] = BUILTIN.map(command => ({
    command,
    source: 'builtin' as const,
  }))
  for (const c of mcpCommands) {
    out.push({
      command: `/${c.serverId}:${c.promptName}`,
      source: 'mcp',
      description: c.description,
    })
  }
  for (const s of skills) {
    out.push({
      command: `/${s.name}`,
      source: 'skill',
      description: s.description,
    })
  }
  return out
}

export function filterSlashSuggestions(
  prefix: string,
  all: readonly SlashSuggestion[],
  limit = 8,
): SlashSuggestion[] {
  const p = prefix.trim().toLowerCase()
  if (!p.startsWith('/')) return []
  return all
    .filter(s => s.command.toLowerCase().startsWith(p))
    .slice(0, limit)
}
