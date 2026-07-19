import { z } from 'zod'
import type { Tool } from '../Tool.js'

const skillInputSchema = z.object({
  skill: z.string().min(1).describe('要加载的技能名称'),
})

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
    return { data: skill.body }
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
