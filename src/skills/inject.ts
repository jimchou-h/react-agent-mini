/**
 * Skill 注入正文：与 Skill 工具 / REPL slash 共用格式
 */

import { dirname } from 'node:path'
import type { DiscoveredSkill } from './discover.js'

/**
 * 构造注入到会话的 Skill 正文（含 base directory 与可选 Arguments）。
 */
export function formatSkillInjection(
  skill: DiscoveredSkill,
  args?: string,
): string {
  const baseDir = dirname(skill.path)
  const parts = [`Base directory for this skill: ${baseDir}`]
  if (args?.trim()) {
    parts.push(`Arguments: ${args.trim()}`)
  }
  parts.push('', skill.body)
  return parts.join('\n')
}
