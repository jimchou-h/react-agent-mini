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

  test('prepends system message when systemPrompt is provided', () => {
    const result = messagesToOpenAI([createUserMessage('你好')], 'project rules')

    expect(result).toEqual([
      { role: 'system', content: 'project rules' },
      { role: 'user', content: '你好' },
    ] satisfies ChatCompletionMessageParam[])
  })

  test('omits system message when systemPrompt is empty', () => {
    const result = messagesToOpenAI([createUserMessage('你好')], '')

    expect(result).toEqual([{ role: 'user', content: '你好' }])
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
  test('includes all registered tool definitions with JSON schema', () => {
    const tools = toolsToOpenAI(getTools())

    expect(tools).toHaveLength(6)
    const names = tools.map(t => t.function.name).sort()
    expect(names).toEqual(['Echo', 'Glob', 'Grep', 'Read', 'Skill', 'Write'])

    const echo = tools.find(t => t.function.name === 'Echo')
    expect(echo?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    })

    const read = tools.find(t => t.function.name === 'Read')
    expect(read?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        path: { type: 'string' },
        offset: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['path'],
    })

    const grep = tools.find(t => t.function.name === 'Grep')
    expect(grep?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
      required: ['pattern'],
    })

    const glob = tools.find(t => t.function.name === 'Glob')
    expect(glob?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
      required: ['pattern'],
    })

    const skill = tools.find(t => t.function.name === 'Skill')
    expect(skill?.function.parameters).toMatchObject({
      type: 'object',
      properties: {
        skill: { type: 'string' },
      },
      required: ['skill'],
    })
  })
})
