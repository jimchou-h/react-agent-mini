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

  test('always includes Memory path guidance even when file is empty', () => {
    const result = buildSystemPrompt('Project rules', [], undefined, '/ws')
    expect(result).toContain('.agents/memory/MEMORY.md')
    expect(result).toContain('Project rules')
    expect(result).toContain('remember')
    const projectAt = result!.indexOf('Project rules')
    const memoryAt = result!.indexOf('## Agent Memory')
    expect(memoryAt).toBeGreaterThan(projectAt)
  })

  test('places Memory after project context and before skills', () => {
    const result = buildSystemPrompt(
      'AGENTS body',
      [
        {
          name: 'review',
          body: '# Review',
          path: '/workspace/.agents/skills/review/SKILL.md',
        },
      ],
      'MEMORY body',
      '/workspace',
    )
    expect(result).toBeDefined()
    const agentsAt = result!.indexOf('AGENTS body')
    const memoryAt = result!.indexOf('MEMORY body')
    const skillsAt = result!.indexOf('## Available Skills')
    expect(agentsAt).toBeGreaterThanOrEqual(0)
    expect(memoryAt).toBeGreaterThan(agentsAt)
    expect(skillsAt).toBeGreaterThan(memoryAt)
    expect(result).toContain('.agents/memory/MEMORY.md')
  })

  test('Memory guidance alone still yields a system prompt', () => {
    const result = buildSystemPrompt(undefined, [], undefined, '/ws')
    expect(result).toContain('## Agent Memory')
    expect(result).toContain('currently empty')
  })

  test('loads project context, memory, and skills into one session snapshot', async () => {
    let projectLoads = 0
    let skillScans = 0
    let memoryLoads = 0
    let ensureCalls = 0
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
      async loadAgentMemory(cwd) {
        memoryLoads++
        expect(cwd).toBe('/workspace')
        return 'prefer dark mode'
      },
      async ensureMemoryDirExists(cwd) {
        ensureCalls++
        expect(cwd).toBe('/workspace')
      },
    })

    expect(projectLoads).toBe(1)
    expect(skillScans).toBe(1)
    expect(memoryLoads).toBe(1)
    expect(ensureCalls).toBe(1)
    expect(session.skills).toBe(skills)
    expect(session.systemPrompt).toContain('Project rules')
    expect(session.systemPrompt).toContain('prefer dark mode')
    expect(session.systemPrompt).toContain('.agents/memory/MEMORY.md')
    expect(session.systemPrompt).toContain('- review')
    expect(session.memory).toBe('prefer dark mode')
  })
})
