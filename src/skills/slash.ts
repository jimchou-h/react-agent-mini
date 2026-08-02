/**
 * Skill slash 解析：`/<skill-id> [args...]`
 *
 * 仅匹配已发现技能；内置 slash 名保留，避免劫持 `/help` 等。
 * REPL 仍须先跑内置 / MCP，再调本函数。
 */

import type { DiscoveredSkill } from './discover.js'

/** 与 parseSlashCommand 对齐的保留名（不含前导 /） */
export const BUILTIN_SLASH_NAMES = new Set([
  'exit',
  'quit',
  'clear',
  'help',
  'compact',
  'memory',
])

export type SkillSlashMatch = {
  skill: DiscoveredSkill
  /** 去掉 skill-id 后的剩余参数；无则为 undefined */
  args?: string
}

/**
 * 解析 Skill slash。未命中（非 `/`、内置名、未知 id）返回 null。
 */
export function parseSkillSlash(
  line: string,
  skills: readonly DiscoveredSkill[],
): SkillSlashMatch | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('/')) return null

  const withoutSlash = trimmed.slice(1)
  if (!withoutSlash) return null

  const spaceIdx = withoutSlash.search(/\s/)
  const id =
    spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx)
  const argsRaw =
    spaceIdx === -1 ? '' : withoutSlash.slice(spaceIdx + 1).trim()

  if (!id || BUILTIN_SLASH_NAMES.has(id)) return null
  // MCP 形态含 `:`，留给 parseMcpSlashCommand
  if (id.includes(':')) return null

  const skill = skills.find(s => s.name === id)
  if (!skill) return null

  return {
    skill,
    ...(argsRaw ? { args: argsRaw } : {}),
  }
}
