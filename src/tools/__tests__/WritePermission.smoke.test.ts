import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createReplCanUseTool } from '../../permissions/canUseTool.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import type { ToolUseBlock } from '../../types/message.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { runToolUse } from '../../services/tools/execution.js'
import { WriteTool } from '../WriteTool.js'

describe('Write permission smoke', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'write-smoke-'))
    process.chdir(testDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('REPL deny leaves file unchanged', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_deny_w',
      name: 'Write',
      input: { path: 'denied.txt', content: 'should-not-exist' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([WriteTool]),
      canUseTool: createReplCanUseTool(async () => 'n'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
    }
    await expect(access('denied.txt')).rejects.toBeDefined()
  })

  test('REPL allow writes the file', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_allow_w',
      name: 'Write',
      input: { path: 'allowed.txt', content: 'written-ok' },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([WriteTool]),
      canUseTool: createReplCanUseTool(async () => 'y'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
    }
    expect(await readFile('allowed.txt', 'utf-8')).toBe('written-ok')
  })
})
