import { describe, expect, test } from 'bun:test'
import type { DiscoveredSkill } from '../discover.js'
import { formatSkillInjection } from '../inject.js'
import { parseSkillSlash } from '../slash.js'

function skill(
  name: string,
  body = '# Body',
  path = `/workspace/.agents/skills/${name}/SKILL.md`,
): DiscoveredSkill {
  return { name, body, path, description: `${name} desc` }
}

describe('formatSkillInjection', () => {
  test('includes base directory and body', () => {
    const text = formatSkillInjection(skill('echo-demo', 'Hello skill'))
    expect(text).toContain(
      'Base directory for this skill: /workspace/.agents/skills/echo-demo',
    )
    expect(text).toContain('Hello skill')
    expect(text).not.toContain('Arguments:')
  })

  test('appends Arguments when args provided', () => {
    const text = formatSkillInjection(
      skill('skill-creator'),
      '  make foo  ',
    )
    expect(text).toContain('Arguments: make foo')
    expect(text).toContain('# Body')
  })
})

describe('parseSkillSlash', () => {
  const skills = [skill('echo-demo'), skill('skill-creator')]

  test('hits skill with no args', () => {
    const m = parseSkillSlash('/echo-demo', skills)
    expect(m?.skill.name).toBe('echo-demo')
    expect(m?.args).toBeUndefined()
  })

  test('hits skill with args', () => {
    const m = parseSkillSlash(
      '/skill-creator 帮我写一个 foo skill',
      skills,
    )
    expect(m?.skill.name).toBe('skill-creator')
    expect(m?.args).toBe('帮我写一个 foo skill')
  })

  test('builtin names do not match even if skill exists', () => {
    const withHelp = [skill('help'), ...skills]
    expect(parseSkillSlash('/help', withHelp)).toBeNull()
    expect(parseSkillSlash('/clear', withHelp)).toBeNull()
    expect(parseSkillSlash('/compact', withHelp)).toBeNull()
  })

  test('unknown skill returns null', () => {
    expect(parseSkillSlash('/nope', skills)).toBeNull()
    expect(parseSkillSlash('not-slash', skills)).toBeNull()
  })

  test('MCP-style id with colon returns null', () => {
    expect(parseSkillSlash('/myserver:greet', skills)).toBeNull()
  })
})
