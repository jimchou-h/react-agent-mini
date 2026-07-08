import { describe, expect, test } from 'bun:test'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getTools } from '../../../../tools/index.js'
import {
  createAssistantMessage,
  createToolResultMessage,
  createUserMessage,
} from '../../../../utils/messages.js'
import { messagesToOpenAI, toolsToOpenAI } from '../adapter.js'

describe('messagesToOpenAI', () => {
  test('converts user text to OpenAI user message', () => {
    const result = messagesToOpenAI([createUserMessage('你好')])

    expect(result).toEqual([
      { role: 'user', content: '你好' },
    ] satisfies ChatCompletionMessageParam[])
  })

  test('converts assistant text to OpenAI assistant message', () => {
    const result = messagesToOpenAI([
      createUserMessage('hi'),
      createAssistantMessage([{ type: 'text', text: 'hello' }]),
    ])

    expect(result).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
  })

  test('converts assistant tool_use to OpenAI tool_calls', () => {
    const result = messagesToOpenAI([
      createUserMessage('echo'),
      createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'Echo',
          input: { message: 'ping' },
        },
      ]),
    ])

    expect(result[1]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'toolu_1',
          type: 'function',
          function: { name: 'Echo', arguments: '{"message":"ping"}' },
        },
      ],
    })
  })

  test('emits tool messages before user text in the same user turn', () => {
    const result = messagesToOpenAI([
      createAssistantMessage([
        {
          type: 'tool_use',
          id: 'toolu_1',
          name: 'Echo',
          input: { message: 'ping' },
        },
      ]),
      {
        type: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'ping' },
          { type: 'text', text: '继续' },
        ],
      },
    ])

    expect(result).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'toolu_1',
            type: 'function',
            function: { name: 'Echo', arguments: '{"message":"ping"}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'toolu_1', content: 'ping' },
      { role: 'user', content: '继续' },
    ])
  })

  test('converts standalone tool_result user message', () => {
    const result = messagesToOpenAI([
      createToolResultMessage('toolu_1', 'ok', false),
    ])

    expect(result).toEqual([
      { role: 'tool', tool_call_id: 'toolu_1', content: 'ok' },
    ])
  })
})

describe('toolsToOpenAI', () => {
  test('includes Echo tool definition with JSON schema', () => {
    const tools = toolsToOpenAI(getTools())

    expect(tools).toHaveLength(1)
    expect(tools[0]?.type).toBe('function')
    expect(tools[0]?.function.name).toBe('Echo')
    expect(tools[0]?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    })
  })
})
