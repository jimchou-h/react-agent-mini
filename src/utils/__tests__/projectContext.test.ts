import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext, MAX_PROJECT_CONTEXT_BYTES } from '../projectContext.js'

describe('loadProjectContext', () => {
  let rootDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    rootDir = await mkdtemp(join(tmpdir(), 'project-context-'))
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(rootDir, { recursive: true, force: true })
  })

  test('loads AGENTS.md from cwd', async () => {
    await writeFile(join(rootDir, 'AGENTS.md'), '# Agent rules\n', 'utf-8')
    process.chdir(rootDir)

    const content = await loadProjectContext()

    expect(content).toBe('# Agent rules\n')
  })

  test('loads CLAUDE.md when AGENTS.md is absent', async () => {
    await writeFile(join(rootDir, 'CLAUDE.md'), '# Claude rules\n', 'utf-8')
    process.chdir(rootDir)

    const content = await loadProjectContext()

    expect(content).toBe('# Claude rules\n')
  })

  test('merges AGENTS.md and CLAUDE.md in the same directory', async () => {
    await writeFile(join(rootDir, 'AGENTS.md'), 'agents', 'utf-8')
    await writeFile(join(rootDir, 'CLAUDE.md'), 'claude', 'utf-8')
    process.chdir(rootDir)

    const content = await loadProjectContext()

    expect(content).toBe(`agents\n\n---\n\nclaude`)
  })

  test('returns undefined when no context files exist', async () => {
    process.chdir(rootDir)

    const content = await loadProjectContext()

    expect(content).toBeUndefined()
  })

  test('walks upward until a parent directory has context files', async () => {
    const child = join(rootDir, 'pkg', 'src')
    await mkdir(child, { recursive: true })
    await writeFile(join(rootDir, 'AGENTS.md'), 'from parent', 'utf-8')
    process.chdir(child)

    const content = await loadProjectContext()

    expect(content).toBe('from parent')
  })

  test('truncates merged context over 64KB with a note', async () => {
    const big = 'x'.repeat(MAX_PROJECT_CONTEXT_BYTES + 1)
    await writeFile(join(rootDir, 'AGENTS.md'), big, 'utf-8')
    process.chdir(rootDir)

    const content = await loadProjectContext()

    expect(content).toBeDefined()
    expect(content!.endsWith('[project context truncated at 64KB]')).toBe(true)
    expect(Buffer.byteLength(content!, 'utf-8')).toBeLessThanOrEqual(
      MAX_PROJECT_CONTEXT_BYTES,
    )
  })
})
