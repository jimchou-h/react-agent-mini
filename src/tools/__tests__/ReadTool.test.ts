import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FILE_UNCHANGED_STUB,
  MAX_READ_BYTES,
  ReadTool,
  resolvePathUnderCwd,
} from '../ReadTool.js'
import type { ReadFileStateEntry } from '../../Tool.js'

function ctx(state?: Map<string, ReadFileStateEntry>) {
  return {
    tools: [ReadTool],
    readFileState: state ?? new Map(),
  }
}

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

  test('reads existing UTF-8 file with line number prefixes', async () => {
    await writeFile('sample.txt', 'hello read', 'utf-8')

    const result = await ReadTool.call(
      { file_path: 'sample.txt' },
      ctx(),
    )

    expect(result.data).toBe('1\thello read')
  })

  test('reads a line range with offset and limit and line number prefixes', async () => {
    await writeFile('lines.txt', 'one\ntwo\nthree\nfour\n', 'utf-8')

    const result = await ReadTool.call(
      { file_path: 'lines.txt', offset: 2, limit: 2 },
      ctx(),
    )

    expect(result.data).toBe('2\ttwo\n3\tthree')
  })

  test('treats offset 0 as the first line', async () => {
    await writeFile('lines.txt', 'one\ntwo\n', 'utf-8')

    const result = await ReadTool.call(
      { file_path: 'lines.txt', offset: 0, limit: 1 },
      ctx(),
    )

    expect(result.data).toBe('1\tone')
  })

  test('rejects legacy path field', async () => {
    await writeFile('sample.txt', 'hello', 'utf-8')

    await expect(
      ReadTool.call({ path: 'sample.txt' } as unknown as { file_path: string }, {
        tools: [ReadTool],
      }),
    ).rejects.toThrow()
  })

  test('throws when file does not exist', async () => {
    await expect(
      ReadTool.call({ file_path: 'missing.txt' }, { tools: [ReadTool] }),
    ).rejects.toThrow('文件不存在')
  })

  test('throws when file exceeds 100KB', async () => {
    const big = 'x'.repeat(MAX_READ_BYTES + 1)
    await writeFile('big.txt', big, 'utf-8')

    await expect(
      ReadTool.call({ file_path: 'big.txt' }, { tools: [ReadTool] }),
    ).rejects.toThrow('文件过大')
  })

  test('is read-only and concurrency-safe', () => {
    expect(ReadTool.isReadOnly({ file_path: 'a.txt' })).toBe(true)
    expect(ReadTool.isConcurrencySafe({ file_path: 'a.txt' })).toBe(true)
  })

  test('dedups identical Read when mtime unchanged (CC readFileState)', async () => {
    await writeFile('same.txt', 'alpha', 'utf-8')
    const state = new Map<string, ReadFileStateEntry>()
    const first = await ReadTool.call({ file_path: 'same.txt' }, ctx(state))
    expect(first.data).toBe('1\talpha')

    const second = await ReadTool.call({ file_path: 'same.txt' }, ctx(state))
    expect(second.data).toBe(FILE_UNCHANGED_STUB)
  })

  test('re-reads when file content changes on disk', async () => {
    await writeFile('mut.txt', 'v1', 'utf-8')
    const state = new Map<string, ReadFileStateEntry>()
    await ReadTool.call({ file_path: 'mut.txt' }, ctx(state))

    // ensure mtime advances on Windows
    await new Promise(r => setTimeout(r, 20))
    await writeFile('mut.txt', 'v2', 'utf-8')

    const again = await ReadTool.call({ file_path: 'mut.txt' }, ctx(state))
    expect(again.data).toBe('1\tv2')
  })
})
