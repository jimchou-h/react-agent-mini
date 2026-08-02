import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadAgentMemory,
  MAX_MEMORY_BYTES,
  MEMORY_RELATIVE_PATH,
} from '../load.js'

describe('loadAgentMemory', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agent-memory-'))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  test('returns undefined when MEMORY.md is missing', async () => {
    expect(await loadAgentMemory(rootDir)).toBeUndefined()
  })

  test('loads .agents/memory/MEMORY.md from cwd', async () => {
    const dir = join(rootDir, '.agents', 'memory')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'MEMORY.md'), 'prefer tabs\n', 'utf-8')

    expect(await loadAgentMemory(rootDir)).toBe('prefer tabs\n')
    expect(MEMORY_RELATIVE_PATH).toBe('.agents/memory/MEMORY.md')
  })

  test('truncates Memory over budget', async () => {
    const dir = join(rootDir, '.agents', 'memory')
    await mkdir(dir, { recursive: true })
    const big = 'm'.repeat(MAX_MEMORY_BYTES + 4096)
    await writeFile(join(dir, 'MEMORY.md'), big, 'utf-8')

    const content = await loadAgentMemory(rootDir)
    expect(content).toBeDefined()
    expect(Buffer.byteLength(content!, 'utf-8')).toBeLessThanOrEqual(
      MAX_MEMORY_BYTES,
    )
    expect(content).toContain('[memory truncated')
  })
})
