import { describe, expect, test } from 'bun:test'
import type { ToolUseBlock } from '../../../types/message.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import { runTools } from '../orchestration.js'
import { createAssistantMessage } from '../../../utils/messages.js'

describe('runTools', () => {
  test('executes Echo and yields tool_result user message', async () => {
    const tools = getTools()
    const context = createMinimalToolContext(tools)
    const blocks: ToolUseBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_test_1',
        name: 'Echo',
        input: { message: '测试' },
      },
    ]
    const parent = createAssistantMessage([
      { type: 'tool_use', id: blocks[0]!.id, name: 'Echo', input: blocks[0]!.input },
    ])

    const updates = []
    for await (const update of runTools(blocks, parent, context)) {
      updates.push(update)
    }

    const resultMessage = updates.find(u => u.message?.type === 'user')?.message
    expect(resultMessage).toBeDefined()
    const content = resultMessage!.content
    expect(Array.isArray(content)).toBe(true)
    const block = content.find(b => b.type === 'tool_result')
    expect(block?.type).toBe('tool_result')
    if (block?.type === 'tool_result') {
      expect(block.content).toBe('测试')
      expect(block.is_error).toBeFalsy()
    }
  })

  test('returns error tool_result for unknown tool', async () => {
    const tools = getTools()
    const context = createMinimalToolContext(tools)
    const blocks: ToolUseBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_unknown',
        name: 'NoSuchTool',
        input: {},
      },
    ]
    const parent = createAssistantMessage([
      { type: 'tool_use', id: 'toolu_unknown', name: 'NoSuchTool', input: {} },
    ])

    const updates = []
    for await (const update of runTools(blocks, parent, context)) {
      updates.push(update)
    }

    const resultMessage = updates.find(u => u.message?.type === 'user')?.message
    const block = resultMessage?.content.find(b => b.type === 'tool_result')
    expect(block?.type).toBe('tool_result')
    if (block?.type === 'tool_result') {
      expect(block.is_error).toBe(true)
    }
  })
})
