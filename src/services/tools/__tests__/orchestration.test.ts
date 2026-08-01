import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { ToolUseBlock } from '../../../types/message.js'
import type { Tool } from '../../../Tool.js'
import { getTools } from '../../../tools/index.js'
import { createMinimalToolContext } from '../../../testing/fixtures.js'
import {
  runTools,
  SKIPPED_TOOL_RESULT_MESSAGE,
} from '../orchestration.js'
import { createAssistantMessage } from '../../../utils/messages.js'

function toolResultsFromUpdates(
  updates: Array<{ message?: { content: unknown[] } }>,
) {
  const results: Array<{
    tool_use_id: string
    content: string
    is_error?: boolean
  }> = []
  for (const u of updates) {
    for (const b of u.message?.content ?? []) {
      if (
        b &&
        typeof b === 'object' &&
        'type' in b &&
        (b as { type: string }).type === 'tool_result'
      ) {
        const tr = b as unknown as {
          tool_use_id: string
          content: string
          is_error?: boolean
        }
        results.push(tr)
      }
    }
  }
  return results
}

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

  test('returns error tool_result when Read path is outside cwd', async () => {
    const tools = getTools()
    const context = createMinimalToolContext(tools)
    const blocks: ToolUseBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_read_escape',
        name: 'Read',
        input: { file_path: '../../outside.txt' },
      },
    ]
    const parent = createAssistantMessage([
      {
        type: 'tool_use',
        id: 'toolu_read_escape',
        name: 'Read',
        input: blocks[0]!.input,
      },
    ])

    const updates = []
    for await (const update of runTools(blocks, parent, context)) {
      updates.push(update)
    }

    const block = updates[0]?.message?.content.find(b => b.type === 'tool_result')
    expect(block?.type).toBe('tool_result')
    if (block?.type === 'tool_result') {
      expect(block.is_error).toBe(true)
      expect(block.content).toContain('拒绝访问')
    }
  })

  test('abort synthesizes tool_result for remaining tools without calling them', async () => {
    let spyCalls = 0
    const spySchema = z.object({ n: z.number() })
    const spyTool: Tool<typeof spySchema> = {
      name: 'Spy',
      description: 'tracks call()',
      inputSchema: spySchema,
      async call() {
        spyCalls++
        return { data: 'ran' }
      },
      isReadOnly() {
        return true
      },
      isConcurrencySafe() {
        return true
      },
      isEnabled() {
        return true
      },
    }

    const abortController = new AbortController()
    const write = getTools().find(t => t.name === 'Write')!
    const context = {
      ...createMinimalToolContext([spyTool, write]),
      abortController,
      canUseTool: async (tool: Tool) => {
        if (tool.name === 'Write') {
          abortController.abort('user_reject')
          return { behavior: 'deny' as const, message: 'rejected' }
        }
        return { behavior: 'allow' as const }
      },
    }

    const blocks: ToolUseBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_a',
        name: 'Spy',
        input: { n: 1 },
      },
      {
        type: 'tool_use',
        id: 'toolu_b',
        name: 'Write',
        input: { file_path: 'x.txt', content: 'no' },
      },
      {
        type: 'tool_use',
        id: 'toolu_c',
        name: 'Spy',
        input: { n: 2 },
      },
    ]
    const parent = createAssistantMessage(blocks)

    const updates = []
    for await (const update of runTools(blocks, parent, context)) {
      updates.push(update)
    }

    const results = toolResultsFromUpdates(updates)
    expect(results.map(r => r.tool_use_id)).toEqual([
      'toolu_a',
      'toolu_b',
      'toolu_c',
    ])
    expect(results[0]!.is_error).toBeFalsy()
    expect(results[1]!.is_error).toBe(true)
    expect(results[1]!.content).toBe('rejected')
    expect(results[2]!.is_error).toBe(true)
    expect(results[2]!.content).toBe(SKIPPED_TOOL_RESULT_MESSAGE)
    // 仅第一个 Spy 执行；第三个因 abort 跳过
    expect(spyCalls).toBe(1)
  })

  test('skipped tools do not run PreToolUse hooks', async () => {
    let hookRuns = 0
    const abortController = new AbortController()
    abortController.abort('already')

    const tools = getTools()
    const context = {
      ...createMinimalToolContext(tools),
      abortController,
      hooksConfig: {
        PreToolUse: [{ matcher: '*', command: 'should-not-run' }],
      },
      hookExec: async () => {
        hookRuns++
        return { exitCode: 0, stdout: '', stderr: '' }
      },
    }

    const blocks: ToolUseBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_skip',
        name: 'Echo',
        input: { message: 'x' },
      },
    ]
    const parent = createAssistantMessage(blocks)

    const updates = []
    for await (const update of runTools(blocks, parent, context)) {
      updates.push(update)
    }

    expect(hookRuns).toBe(0)
    const results = toolResultsFromUpdates(updates)
    expect(results).toHaveLength(1)
    expect(results[0]!.content).toBe(SKIPPED_TOOL_RESULT_MESSAGE)
  })
})
