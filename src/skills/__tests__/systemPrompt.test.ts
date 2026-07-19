import { describe, expect, test } from 'bun:test'
import { buildSystemPrompt, loadSessionContext } from '../systemPrompt.js'

describe('buildSystemPrompt', () => {
  test('appends available skill names and descriptions to project context', () => {
    const result = buildSystemPrompt('Project rules', [
      {
        name: 'review',
        description: 'Review a change',
        body: '# Review',
        path: '/workspace/.agents/skills/review/SKILL.md',
      },
      {
        name: 'teach',
        body: '# Teach',
        path: '/workspace/.claude/skills/teach/SKILL.md',
      },
    ])

    expect(result).toContain('Project rules')
    expect(result).toContain('## Available Skills')
    expect(result).toContain('- review — Review a change')
    expect(result).toContain('- teach')
  })

  test('leaves project context unchanged when no skills are available', () => {
    expect(buildSystemPrompt('Project rules', [])).toBe('Project rules')
    expect(buildSystemPrompt(undefined, [])).toBeUndefined()
  })

  test('loads project context and skills once into one session snapshot', async () => {
    let projectLoads = 0
    let skillScans = 0
    const skills = [
      {
        name: 'review',
        body: '# Review',
        path: '/workspace/.agents/skills/review/SKILL.md',
      },
    ]

    const session = await loadSessionContext('/workspace', {
      async loadProjectContext(cwd) {
        projectLoads++
        expect(cwd).toBe('/workspace')
        return 'Project rules'
      },
      async discoverSkills(cwd) {
        skillScans++
        expect(cwd).toBe('/workspace')
        return skills
      },
    })

    expect(projectLoads).toBe(1)
    expect(skillScans).toBe(1)
    expect(session.skills).toBe(skills)
    expect(session.systemPrompt).toContain('- review')
  })
})
