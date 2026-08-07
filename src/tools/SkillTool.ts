/**
 * Skill 工具：按目录名加载已发现的 SKILL.md
 *
 * tool_result 只回短确认；正文经 prependMessages 在 tool_result **之后**注入本轮
 * （保证 OpenAI tool_calls 配对；再被 query 送给模型）。
 * 入参 `skill` 必须是目录名（调用 ID），不是 frontmatter displayName。
 */

import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { formatSkillInjection } from '../skills/inject.js'
import { createUserMessage } from '../utils/messages.js'

const skillInputSchema = z.object({
  skill: z.string().min(1).describe('要加载的技能名称（目录名）'),
  args: z.string().optional().describe('可选参数，会附在技能说明前'),
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
