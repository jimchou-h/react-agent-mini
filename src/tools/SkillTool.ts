import { dirname } from 'node:path'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import type { DiscoveredSkill } from '../skills/discover.js'
import { createUserMessage } from '../utils/messages.js'

const skillInputSchema = z.object({
  skill: z.string().min(1).describe('要加载的技能名称（目录名）'),
  args: z.string().optional().describe('可选参数，会附在技能说明前'),
})

function formatSkillInjection(skill: DiscoveredSkill, args?: string): string {
  const baseDir = dirname(skill.path)
  const parts = [`Base directory for this skill: ${baseDir}`]
  if (args?.trim()) {
    parts.push(`Arguments: ${args.trim()}`)
  }
  parts.push('', skill.body)
  return parts.join('\n')
}

/** 按名称把已发现的 SKILL.md 正文加载进当前工具回合。 */
export const SkillTool: Tool<typeof skillInputSchema> = {
  name: 'Skill',
  description: '按名称加载可用 Skill 的 Markdown 正文',
  inputSchema: skillInputSchema,

  async call(args, context) {
    const skill = context.skills?.find(candidate => candidate.name === args.skill)
    if (!skill) {
      throw new Error(`技能不存在: ${args.skill}`)
    }
    return {
      data: `Launching skill: ${skill.name}`,
      prependMessages: [
        createUserMessage(formatSkillInjection(skill, args.args)),
      ],
    }
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  isEnabled() {
    return true
  },
}
