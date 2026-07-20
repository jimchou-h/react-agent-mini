import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getTools } from '../index.js'
import { WriteTool, MAX_WRITE_BYTES } from '../WriteTool.js'
import { formatToolStartStatus } from '../../entrypoints/cliHelpers.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { runToolUse } from '../../services/tools/execution.js'
import type { ToolUseBlock } from '../../types/message.js'

describe('WriteTool', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'write-tool-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('writes UTF-8 content when path is under cwd and parent exists', async () => {
    const result = await WriteTool.call(
      { path: 'out.txt', content: 'hello write' },
      createMinimalToolContext([WriteTool]),
    )

    expect(result.data).toContain('out.txt')
    expect(await readFile('out.txt', 'utf-8')).toBe('hello write')
  })

  test('overwrites an existing file', async () => {
    await writeFile('out.txt', 'old', 'utf-8')

    await WriteTool.call(
      { path: 'out.txt', content: 'new' },
      createMinimalToolContext([WriteTool]),
    )

    expect(await readFile('out.txt', 'utf-8')).toBe('new')
  })

  test('rejects path outside cwd', async () => {
    await expect(
      WriteTool.call(
        { path: '../../outside.txt', content: 'x' },
        createMinimalToolContext([WriteTool]),
      ),
    ).rejects.toThrow('拒绝访问')
  })

  test('rejects content over 100KB', async () => {
    const big = 'x'.repeat(MAX_WRITE_BYTES + 1)

    await expect(
      WriteTool.call(
        { path: 'big.txt', content: big },
        createMinimalToolContext([WriteTool]),
      ),
    ).rejects.toThrow('内容过大')
  })

  test('is not read-only', () => {
    expect(WriteTool.isReadOnly({ path: 'a.txt', content: 'x' })).toBe(false)
  })

  test('is registered in getTools and formats CLI status', () => {
    expect(getTools().some(t => t.name === 'Write')).toBe(true)
    expect(
      formatToolStartStatus({
        type: 'tool_use',
        id: 'toolu_w',
        name: 'Write',
        input: { path: 'a.txt', content: 'x' },
      }),
    ).toBe('[工具] Write: a.txt')
  })

  test('runToolUse writes when canUseTool allows', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_write_1',
      name: 'Write',
      input: { path: 'via-exec.txt', content: 'via runToolUse' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([WriteTool]),
      canUseTool: async () => ({ behavior: 'allow' }),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
    }
    expect(await readFile('via-exec.txt', 'utf-8')).toBe('via runToolUse')
  })
})
