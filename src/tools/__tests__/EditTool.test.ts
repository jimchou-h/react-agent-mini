import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { EditTool, MAX_EDIT_BYTES } from '../EditTool.js'

describe('EditTool', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'edit-tool-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('replaces a unique old_string match', async () => {
    await writeFile('a.txt', 'hello world\n', 'utf-8')

    const result = await EditTool.call(
      { path: 'a.txt', old_string: 'world', new_string: 'bun' },
      createMinimalToolContext([EditTool]),
    )

    expect(result.data).toContain('a.txt')
    expect(await readFile('a.txt', 'utf-8')).toBe('hello bun\n')
  })

  test('errors when old_string is missing', async () => {
    await writeFile('a.txt', 'hello\n', 'utf-8')

    await expect(
      EditTool.call(
        { path: 'a.txt', old_string: 'missing', new_string: 'x' },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('未找到')

    expect(await readFile('a.txt', 'utf-8')).toBe('hello\n')
  })

  test('errors when old_string matches multiple times without replace_all', async () => {
    await writeFile('a.txt', 'aa aa aa\n', 'utf-8')

    await expect(
      EditTool.call(
        { path: 'a.txt', old_string: 'aa', new_string: 'bb' },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('多次')

    expect(await readFile('a.txt', 'utf-8')).toBe('aa aa aa\n')
  })

  test('rejects path outside cwd', async () => {
    await expect(
      EditTool.call(
        {
          path: '../../outside.txt',
          old_string: 'a',
          new_string: 'b',
        },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('拒绝访问')
  })

  test('rejects files over 100KB', async () => {
    await writeFile(
      'big.txt',
      `UNIQUE_MARKER${'x'.repeat(MAX_EDIT_BYTES)}`,
      'utf-8',
    )

    await expect(
      EditTool.call(
        {
          path: 'big.txt',
          old_string: 'UNIQUE_MARKER',
          new_string: 'y',
        },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('过大')
  })

  test('rejects when file does not exist', async () => {
    await expect(
      EditTool.call(
        { path: 'nope.txt', old_string: 'a', new_string: 'b' },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('不存在')
  })

  test('rejects when old_string equals new_string', async () => {
    await writeFile('a.txt', 'same\n', 'utf-8')

    await expect(
      EditTool.call(
        { path: 'a.txt', old_string: 'same', new_string: 'same' },
        createMinimalToolContext([EditTool]),
      ),
    ).rejects.toThrow('相同')

    expect(await readFile('a.txt', 'utf-8')).toBe('same\n')
  })

  test('is not read-only', () => {
    expect(
      EditTool.isReadOnly({
        path: 'a.txt',
        old_string: 'a',
        new_string: 'b',
      }),
    ).toBe(false)
  })
})
