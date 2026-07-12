import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReadTool, MAX_READ_BYTES, resolvePathUnderCwd } from '../ReadTool.js'

describe('resolvePathUnderCwd', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'read-tool-path-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('resolves file under cwd', () => {
    const resolved = resolvePathUnderCwd('notes.txt')
    expect(resolved).toBe(join(testDir, 'notes.txt'))
  })

  test('rejects path outside cwd', () => {
    expect(() => resolvePathUnderCwd('../../outside.txt')).toThrow('拒绝访问')
  })
})

describe('ReadTool', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'read-tool-call-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('reads existing UTF-8 file', async () => {
    await writeFile('sample.txt', 'hello read', 'utf-8')

    const result = await ReadTool.call({ path: 'sample.txt' }, { tools: [ReadTool] })

    expect(result.data).toBe('hello read')
  })

  test('throws when file does not exist', async () => {
    await expect(
      ReadTool.call({ path: 'missing.txt' }, { tools: [ReadTool] }),
    ).rejects.toThrow('文件不存在')
  })

  test('throws when file exceeds 100KB', async () => {
    const big = 'x'.repeat(MAX_READ_BYTES + 1)
    await writeFile('big.txt', big, 'utf-8')

    await expect(
      ReadTool.call({ path: 'big.txt' }, { tools: [ReadTool] }),
    ).rejects.toThrow('文件过大')
  })

  test('is read-only and concurrency-safe', () => {
    expect(ReadTool.isReadOnly({ path: 'a.txt' })).toBe(true)
    expect(ReadTool.isConcurrencySafe({ path: 'a.txt' })).toBe(true)
  })
})
