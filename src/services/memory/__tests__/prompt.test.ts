import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ensureMemoryDirExists,
  formatMemoryPromptSection,
  MEMORY_RELATIVE_PATH,
} from '../load.js'

describe('formatMemoryPromptSection', () => {
  test('always includes path and remember guidance when empty', () => {
    const text = formatMemoryPromptSection('/ws')
    expect(text).toContain('## Agent Memory')
    expect(text).toContain(MEMORY_RELATIVE_PATH)
    expect(text).toContain('remember')
    expect(text).toContain('currently empty')
    expect(text).toContain('docs/notes')
  })

  test('appends MEMORY.md body when present', () => {
    const text = formatMemoryPromptSection('/ws', 'prefer tabs')
    expect(text).toContain('prefer tabs')
    expect(text).not.toContain('currently empty')
  })
})

describe('ensureMemoryDirExists', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'mem-dir-'))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  test('creates .agents/memory under cwd', async () => {
    await ensureMemoryDirExists(rootDir)
    await access(join(rootDir, '.agents', 'memory'))
  })
})
