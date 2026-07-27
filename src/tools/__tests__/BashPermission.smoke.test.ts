import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  createHeadlessCanUseTool,
  createReplCanUseTool,
} from '../../permissions/canUseTool.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import type { ToolUseBlock } from '../../types/message.js'
import { createAssistantMessage } from '../../utils/messages.js'
import { runToolUse } from '../../services/tools/execution.js'
import { BashTool } from '../BashTool.js'

function bashBlock(id: string): ToolUseBlock {
  return {
    type: 'tool_use',
    id,
    name: 'Bash',
    input: { command: 'echo permission-check' },
  }
}

describe('Bash permission smoke', () => {
  const prevAllow = process.env.ALLOW_WRITE

  beforeEach(() => {
    delete process.env.ALLOW_WRITE
  })

  afterEach(() => {
    if (prevAllow === undefined) delete process.env.ALLOW_WRITE
    else process.env.ALLOW_WRITE = prevAllow
  })

  test('REPL deny does not execute the command', async () => {
    const block = bashBlock('toolu_bash_deny')
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([BashTool]),
      canUseTool: createReplCanUseTool(async () => 'n'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).not.toContain('permission-check')
    }
  })

  test('headless denies Bash without ALLOW_WRITE', async () => {
    const block = bashBlock('toolu_bash_headless')
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([BashTool]),
      canUseTool: createHeadlessCanUseTool(),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBe(true)
      expect(result.content).toContain('ALLOW_WRITE')
    }
  })

  test('REPL allow runs a harmless command', async () => {
    const block = bashBlock('toolu_bash_allow')
    const parent = createAssistantMessage([block])

    const update = await runToolUse(block, parent, {
      ...createMinimalToolContext([BashTool]),
      canUseTool: createReplCanUseTool(async () => 'y'),
    })

    const result = update.message.content[0]
    expect(result.type).toBe('tool_result')
    if (result.type === 'tool_result') {
      expect(result.is_error).toBeUndefined()
      expect(result.content).toContain('permission-check')
    }
  })
})
