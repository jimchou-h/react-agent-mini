import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createHeadlessCanUseTool,
  createReplCanUseTool,
} from '../../permissions/canUseTool.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import type { ToolUseBlock } from '../../types/message.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { runToolUse } from '../../services/tools/execution.js'
import { EditTool } from '../EditTool.js'

describe('Edit permission smoke', () => {
  let testDir: string
  let originalCwd: string
  const prevAllow = process.env.ALLOW_WRITE

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'edit-smoke-'))
    process.chdir(testDir)
    delete process.env.ALLOW_WRITE
    await writeFile('target.txt', 'alpha beta gamma\n', 'utf-8')
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
    if (prevAllow === undefined) delete process.env.ALLOW_WRITE
    else process.env.ALLOW_WRITE = prevAllow
  })

  test('REPL deny leaves file unchanged', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_deny_e',
      name: 'Edit',
      input: {
        path: 'target.txt',
        old_string: 'beta',
        new_string: 'BETA',
      },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([EditTool]),
      canUseTool: createReplCanUseTool(async () => 'n'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
    }
    expect(await readFile('target.txt', 'utf-8')).toBe('alpha beta gamma\n')
  })

  test('REPL allow edits the file', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_allow_e',
      name: 'Edit',
      input: {
        path: 'target.txt',
        old_string: 'beta',
        new_string: 'BETA',
      },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([EditTool]),
      canUseTool: createReplCanUseTool(async () => 'y'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
    }
    expect(await readFile('target.txt', 'utf-8')).toBe('alpha BETA gamma\n')
  })

  test('headless denies Edit without ALLOW_WRITE', async () => {
    const block: ToolUseBlock = {
      type: 'tool_use',
      id: 'toolu_headless_e',
      name: 'Edit',
      input: {
        path: 'target.txt',
        old_string: 'beta',
        new_string: 'BETA',
      },
    }
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([EditTool]),
      canUseTool: createHeadlessCanUseTool(),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toContain('ALLOW_WRITE')
    }
    expect(await readFile('target.txt', 'utf-8')).toBe('alpha beta gamma\n')
  })
})
