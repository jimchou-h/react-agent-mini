import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverSkills, MAX_SKILL_BYTES } from '../discover.js'

describe('discoverSkills', () => {
  let workspace: string

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'skills-discover-'))
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  test('discovers and parses a skill under .agents/skills', async () => {
    const skillDir = join(workspace, '.agents', 'skills', 'review')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: review',
        'description: Review a change',
        '---',
        '# Review workflow',
      ].join('\n'),
      'utf-8',
    )

    const skills = await discoverSkills(workspace)

    expect(skills).toEqual([
      {
        name: 'review',
        description: 'Review a change',
        body: '# Review workflow',
        path: join(skillDir, 'SKILL.md'),
      },
    ])
  })

  test('also discovers skills under .claude/skills', async () => {
    const skillDir = join(workspace, '.claude', 'skills', 'teach')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: teach', '---', 'Teach step by step'].join('\n'),
      'utf-8',
    )

    const skills = await discoverSkills(workspace)

    expect(skills.map(skill => skill.name)).toEqual(['teach'])
  })

  test('uses the directory name when frontmatter has no name', async () => {
    const skillDir = join(workspace, '.agents', 'skills', 'fallback-name')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      ['---', 'description: Has no explicit name', '---', 'Body'].join('\n'),
      'utf-8',
    )

    const skills = await discoverSkills(workspace)

    expect(skills[0]?.name).toBe('fallback-name')
  })

  test('returns an empty list when skill roots are absent', async () => {
    await expect(discoverSkills(workspace)).resolves.toEqual([])
  })

  test('truncates a skill body over 32KB and appends a note', async () => {
    const skillDir = join(workspace, '.agents', 'skills', 'large')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      ['---', 'name: large', '---', 'x'.repeat(MAX_SKILL_BYTES + 1)].join(
        '\n',
      ),
      'utf-8',
    )

    const skills = await discoverSkills(workspace)
    const body = skills[0]?.body

    expect(body).toBeDefined()
    expect(body!.endsWith('[skill truncated at 32KB]')).toBe(true)
    expect(Buffer.byteLength(body!, 'utf-8')).toBeLessThanOrEqual(
      MAX_SKILL_BYTES,
    )
  })
})
