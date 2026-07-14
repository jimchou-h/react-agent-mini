import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GlobTool } from '../GlobTool.js'

describe('GlobTool', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'glob-tool-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('lists files matching pattern under cwd', async () => {
    await writeFile('a.ts', '', 'utf-8')
    await writeFile('b.js', '', 'utf-8')
    await mkdir('src', { recursive: true })
    await writeFile(join('src', 'c.ts'), '', 'utf-8')

    const result = await GlobTool.call(
      { pattern: '**/*.ts' },
      { tools: [GlobTool] },
    )

    const output = String(result.data)
    expect(output).toContain('a.ts')
    expect(output).toContain('src/c.ts')
    expect(output).not.toContain('b.js')
  })

  test('lists only under given subdirectory', async () => {
    await mkdir('src', { recursive: true })
    await writeFile(join('src', 'in.ts'), '', 'utf-8')
    await writeFile('out.ts', '', 'utf-8')

    const result = await GlobTool.call(
      { pattern: '**/*.ts', path: 'src' },
      { tools: [GlobTool] },
    )

    const output = String(result.data)
    expect(output).toContain('src/in.ts')
    expect(output).not.toContain('out.ts')
  })

  test('rejects path outside cwd', async () => {
    await expect(
      GlobTool.call(
        { pattern: '**/*', path: '../outside' },
        { tools: [GlobTool] },
      ),
    ).rejects.toThrow('拒绝访问')
  })

  test('truncates results over 100 matches', async () => {
    await mkdir('many', { recursive: true })
    for (let i = 0; i < 110; i++) {
      await writeFile(join('many', `f${i}.txt`), '', 'utf-8')
    }

    const result = await GlobTool.call(
      { pattern: 'many/*.txt' },
      { tools: [GlobTool] },
    )

    const output = String(result.data)
    const paths = output
      .split('\n')
      .filter(l => l.includes('many/') && l.endsWith('.txt'))
    expect(paths).toHaveLength(100)
    expect(output).toContain('已截断')
  })

  test('is read-only and concurrency-safe', () => {
    expect(GlobTool.isReadOnly({ pattern: '**/*' })).toBe(true)
    expect(GlobTool.isConcurrencySafe({ pattern: '**/*' })).toBe(true)
  })
})
