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
  test('mentions AGENTS.md by default and improve-not-overwrite', () => {
    const p = buildInitPrompt()
    expect(p).toContain('AGENTS.md')
    expect(p).toContain('improve')
  })

  test('mentions CLAUDE.md when hint says it exists', () => {
    const p = buildInitPrompt('', { hasClaudeMd: true })
    expect(p).toContain('**CLAUDE.md**')
  })

  test('appends user args', () => {
    const p = buildInitPrompt('focus on test commands')
    expect(p).toContain('focus on test commands')
    expect(p).toContain('Additional user notes')
  })
})
