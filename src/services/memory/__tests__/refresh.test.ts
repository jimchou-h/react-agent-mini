import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadAgentMemorySnapshot,
  refreshMemorySnapshot,
} from '../load.js'

describe('refreshMemorySnapshot', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'memory-refresh-'))
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  test('reuses cache when mtime unchanged', async () => {
    const dir = join(rootDir, '.agents', 'memory')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'MEMORY.md')
    await writeFile(file, 'v1', 'utf-8')
    const first = await loadAgentMemorySnapshot(rootDir)
    expect(first.content).toBe('v1')

    const second = await refreshMemorySnapshot(rootDir, first)
    expect(second.changed).toBe(false)
    expect(second.snapshot.content).toBe('v1')
    expect(second.snapshot.mtimeMs).toBe(first.mtimeMs)
  })

  test('reloads when mtime changes', async () => {
    const dir = join(rootDir, '.agents', 'memory')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'MEMORY.md')
    await writeFile(file, 'v1', 'utf-8')
    const first = await loadAgentMemorySnapshot(rootDir)

    await writeFile(file, 'v2', 'utf-8')
    const later = new Date(Date.now() + 2000)
    await utimes(file, later, later)

    const second = await refreshMemorySnapshot(rootDir, first)
    expect(second.changed).toBe(true)
    expect(second.snapshot.content).toBe('v2')
  })
})
