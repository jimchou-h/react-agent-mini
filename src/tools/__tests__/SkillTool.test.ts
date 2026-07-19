import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../types/message.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { runToolUse } from '../../services/tools/execution.js'
import { formatToolStartStatus } from '../../entrypoints/cliHelpers.js'
import { getTools } from '../index.js'
import { SkillTool } from '../SkillTool.js'

describe('SkillTool', () => {
  test('returns the body of a discovered skill through tool_result', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_skill_1',
      name: 'Skill',
      input: { skill: 'review' },
    }

    const update = await runToolUse(
      block,
      createAssistantMessage([block]),
      {
        tools: [SkillTool],
        skills: [
          {
            name: 'review',
            description: 'Review changes',
            body: '# Review workflow',
            path: '/workspace/.agents/skills/review/SKILL.md',
          },
        ],
      },
    )

    expect(update.message.content).toEqual([
      {
        type: 'tool_result',
        tool_use_id: 'toolu_skill_1',
        content: '# Review workflow',
      },
    ])
  })

  test('returns an error tool_result for an unknown skill', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_skill_missing',
      name: 'Skill',
      input: { skill: 'missing' },
    }

    const update = await runToolUse(
      block,
      createAssistantMessage([block]),
      { tools: [SkillTool], skills: [] },
    )
    const result = update.message.content[0]

    expect(result?.type).toBe('tool_result')
    if (result?.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toContain('技能不存在: missing')
    }
  })

  test('is registered as read-only and formats CLI status', () => {
    const registered = getTools().find(tool => tool.name === 'Skill')

    expect(registered).toBe(SkillTool)
    expect(SkillTool.isReadOnly({ skill: 'review' })).toBe(true)
    expect(
      formatToolStartStatus({
        type: 'tool_use',
        id: 'toolu_skill_status',
        name: 'Skill',
        input: { skill: 'review' },
      }),
    ).toBe('[工具] Skill: review')
  })
})
