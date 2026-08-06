import { describe, expect, test } from 'bun:test'
import {
  buildInitPrompt,
  resolveInitTargetFile,
} from '../initSlash.js'

describe('resolveInitTargetFile', () => {
  test('defaults to AGENTS.md when neither exists', () => {
    expect(resolveInitTargetFile({})).toBe('AGENTS.md')
    expect(resolveInitTargetFile({ hasAgentsMd: false, hasClaudeMd: false })).toBe(
      'AGENTS.md',
    )
  })

  test('prefers CLAUDE.md when it exists', () => {
    expect(resolveInitTargetFile({ hasClaudeMd: true })).toBe('CLAUDE.md')
    expect(
      resolveInitTargetFile({ hasAgentsMd: true, hasClaudeMd: true }),
    ).toBe('CLAUDE.md')
  })

  test('AGENTS.md only still targets AGENTS.md', () => {
    expect(resolveInitTargetFile({ hasAgentsMd: true })).toBe('AGENTS.md')
  })
})

describe('buildInitPrompt', () => {
  test('matches CC OLD_INIT shape with AGENTS.md default', () => {
    const p = buildInitPrompt()
    expect(p).toContain('create a AGENTS.md file')
    expect(p).toContain('What to add:')
    expect(p).toContain('Usage notes:')
    expect(p).toContain('suggest improvements to it')
    expect(p).toContain('# AGENTS.md')
    expect(p).not.toContain('Explore with Read/Glob/Grep')
  })

  test('uses CLAUDE.md when hint says it exists', () => {
    const p = buildInitPrompt('', { hasClaudeMd: true })
    expect(p).toContain('create a CLAUDE.md file')
    expect(p).toContain('# CLAUDE.md')
    expect(p).toContain('claude.ai/code')
  })

  test('appends user args', () => {
    const p = buildInitPrompt('focus on test commands')
    expect(p).toContain('focus on test commands')
    expect(p).toContain('Additional user notes:')
  })
})
