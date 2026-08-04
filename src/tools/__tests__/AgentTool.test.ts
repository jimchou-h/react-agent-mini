import { describe, expect, test } from 'bun:test'
import type { CallModelParams } from '../../query/types.js'
import type { AssistantMessage, StreamEvent } from '../../types/message.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createAssistantMessage } from '../../utils/messages.js'
import {
  AGENT_TOOL_NAME,
  createSubagentContext,
  toolsForSubagent,
} from '../../utils/subagent.js'
import { AgentTool } from '../AgentTool.js'
import { EchoTool } from '../EchoTool.js'
import { getTools } from '../index.js'
import { WriteTool } from '../WriteTool.js'

describe('toolsForSubagent / createSubagentContext', () => {
  test('excludes Agent from child tool pool', () => {
    const tools = toolsForSubagent(getTools())
    expect(tools.some(t => t.name === AGENT_TOOL_NAME)).toBe(false)
    expect(tools.some(t => t.name === 'Echo')).toBe(true)
  })

  test('tool_names allowlist filters further', () => {
    const tools = toolsForSubagent(getTools(), ['Echo'])
    expect(tools.map(t => t.name)).toEqual(['Echo'])
  })

  test('createSubagentContext increments depth and chains abort', () => {
    const parentAbort = new AbortController()
    const parent = {
      ...createMinimalToolContext([EchoTool]),
      depth: 0,
      abortController: parentAbort,
    }
    const child = createSubagentContext(parent)
    expect(child.depth).toBe(1)
    expect(child.abortController).not.toBe(parentAbort)
    parentAbort.abort('stop')
    expect(child.abortController?.signal.aborted).toBe(true)
  })
})

describe('AgentTool', () => {
  test('getTools includes Agent', () => {
    expect(getTools().some(t => t.name === AGENT_TOOL_NAME)).toBe(true)
  })

  test('nested query returns summary without polluting parent messages', async () => {
    async function* mockChildText(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      yield createAssistantMessage([
        { type: 'text', text: 'subagent done' },
      ])
    }

    const parentMessages: unknown[] = []
    const result = await AgentTool.call(
      {
        description: 'demo task',
        prompt: 'say hello',
      },
      {
        ...createMinimalToolContext([EchoTool, AgentTool]),
        depth: 0,
        queryDeps: {
          callModel: mockChildText,
          uuid: () => 'agent-uuid',
        },
      },
    )

    expect(result.isError).toBeUndefined()
    expect(String(result.data)).toContain('[Agent: demo task]')
    expect(String(result.data)).toContain('subagent done')
    expect(parentMessages).toEqual([])
  })

  test('child callModel tools exclude Agent', async () => {
    let sawTools: string[] = []
    async function* mockInspectTools(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      sawTools = params.tools.map(t => t.name)
      yield createAssistantMessage([{ type: 'text', text: 'ok' }])
    }

    await AgentTool.call(
      { description: 'inspect', prompt: 'go' },
      {
        ...createMinimalToolContext(getTools()),
        queryDeps: {
          callModel: mockInspectTools,
          uuid: () => 'u',
        },
      },
    )

    expect(sawTools).not.toContain(AGENT_TOOL_NAME)
    expect(sawTools).toContain('Echo')
  })

  test('depth >= max rejects without calling model', async () => {
    let modelCalls = 0
    async function* mockShouldNotRun(): AsyncGenerator<
      StreamEvent | AssistantMessage
    > {
      modelCalls++
      yield createAssistantMessage([{ type: 'text', text: 'nope' }])
    }

    const result = await AgentTool.call(
      { description: 'nested', prompt: 'again' },
      {
        ...createMinimalToolContext([EchoTool]),
        depth: 1,
        queryDeps: {
          callModel: mockShouldNotRun,
          uuid: () => 'u',
        },
      },
    )

    expect(result.isError).toBe(true)
    expect(String(result.data)).toContain('depth exceeded')
    expect(modelCalls).toBe(0)
  })

  test('parent deny applies inside nested query tool use', async () => {
    async function* mockWriteThenText(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const hasResult = params.messages.some(
        m =>
          m.type === 'user' &&
          m.content.some(b => b.type === 'tool_result'),
      )
      if (!hasResult) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'w1',
            name: 'Write',
            input: { file_path: 'x.txt', content: 'secret' },
          },
        ])
        return
      }
      const err = params.messages
        .flatMap(m => (m.type === 'user' ? m.content : []))
        .find(b => b.type === 'tool_result' && b.is_error)
      yield createAssistantMessage([
        {
          type: 'text',
          text: err ? 'write denied' : 'write ok',
        },
      ])
    }

    const result = await AgentTool.call(
      { description: 'write try', prompt: 'write file' },
      {
        ...createMinimalToolContext([WriteTool, EchoTool]),
        canUseTool: async () => ({
          behavior: 'deny',
          message: 'no writes',
        }),
        queryDeps: {
          callModel: mockWriteThenText,
          uuid: () => 'deny-u',
        },
      },
    )

    expect(result.isError).toBeUndefined()
    expect(String(result.data)).toContain('write denied')
  })

  test('aborted nested query returns is_error', async () => {
    const abortController = new AbortController()
    async function* mockAbortAfterTool(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const hasResult = params.messages.some(
        m =>
          m.type === 'user' &&
          m.content.some(b => b.type === 'tool_result'),
      )
      if (!hasResult) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'e1',
            name: 'Echo',
            input: { message: 'x' },
          },
        ])
        return
      }
      yield createAssistantMessage([{ type: 'text', text: 'should not' }])
    }

    const result = await AgentTool.call(
      { description: 'abort', prompt: 'go' },
      {
        ...createMinimalToolContext([EchoTool]),
        abortController,
        canUseTool: async () => {
          abortController.abort('user')
          return { behavior: 'deny', message: 'nope' }
        },
        queryDeps: {
          callModel: mockAbortAfterTool,
          uuid: () => 'ab',
        },
      },
    )

    expect(result.isError).toBe(true)
    expect(String(result.data)).toContain('aborted')
  })

  test('parent abort during nested stream stops Agent with is_error', async () => {
    const parentAbort = new AbortController()
    let childSawAbort = false
    let secondModelCall = 0

    async function* mockNestedStream(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      secondModelCall++
      yield { type: 'text_delta', text: 'working' }
      await new Promise<never>((_resolve, reject) => {
        const fail = () => {
          childSawAbort = params.signal?.aborted === true
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (params.signal?.aborted) {
          fail()
          return
        }
        params.signal?.addEventListener('abort', fail, { once: true })
      })
    }

    const callPromise = AgentTool.call(
      { description: 'cascade', prompt: 'long task' },
      {
        ...createMinimalToolContext([EchoTool, AgentTool]),
        abortController: parentAbort,
        queryDeps: {
          callModel: mockNestedStream,
          uuid: () => 'cascade-u',
        },
      },
    )

    // 等子 callModel 挂上 abort 监听后再 abort 父
    await new Promise(r => setTimeout(r, 20))
    parentAbort.abort('interrupt')

    const result = await callPromise
    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/abort/i)
    expect(childSawAbort).toBe(true)
    expect(secondModelCall).toBe(1)
  })
})
