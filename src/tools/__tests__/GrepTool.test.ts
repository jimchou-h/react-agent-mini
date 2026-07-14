import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GrepTool } from '../GrepTool.js'

describe('GrepTool', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'grep-tool-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('searches cwd for pattern and returns path with line numbers', async () => {
    await writeFile('a.txt', 'hello world\nfoo bar\n', 'utf-8')

    const result = await GrepTool.call(
      { pattern: 'foo' },
      { tools: [GrepTool] },
    )

    expect(result.data).toContain('a.txt')
    expect(result.data).toMatch(/a\.txt:2:.*foo/)
  })

  test('searches only under given path inside cwd', async () => {
    await mkdir('src', { recursive: true })
    await writeFile(join('src', 'in.ts'), 'const TARGET = 1\n', 'utf-8')
    await writeFile('out.ts', 'const TARGET = 2\n', 'utf-8')

    const result = await GrepTool.call(
      { pattern: 'TARGET', path: 'src' },
      { tools: [GrepTool] },
    )

    expect(result.data).toMatch(/src\/in\.ts:1:.*TARGET/)
    expect(result.data).not.toContain('out.ts')
  })

  test('rejects path outside cwd', async () => {
    await expect(
      GrepTool.call(
        { pattern: 'x', path: '../outside' },
        { tools: [GrepTool] },
      ),
    ).rejects.toThrow('拒绝访问')
  })

  test('truncates results when exceeding head_limit', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `match-line-${i}`).join(
      '\n',
    )
    await writeFile('many.txt', lines, 'utf-8')

    const result = await GrepTool.call(
      { pattern: 'match-line', head_limit: 3 },
      { tools: [GrepTool] },
    )

    const output = String(result.data)
    const matchLines = output
      .split('\n')
      .filter(l => l.includes('many.txt:') && l.includes('match-line'))
    expect(matchLines).toHaveLength(3)
    expect(output).toContain('已截断')
  })

  test('is read-only and concurrency-safe', () => {
    expect(GrepTool.isReadOnly({ pattern: 'x' })).toBe(true)
    expect(GrepTool.isConcurrencySafe({ pattern: 'x' })).toBe(true)
  })
})
