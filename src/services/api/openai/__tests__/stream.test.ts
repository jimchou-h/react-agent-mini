import { describe, expect, test } from 'bun:test'
import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import { parseOpenAIStream } from '../stream.js'

function makeChunk(
  choice: {
    delta?: ChatCompletionChunk.Choice.Delta
    finish_reason?: ChatCompletionChunk.Choice['finish_reason']
  },
): ChatCompletionChunk {
  return {
    id: 'chunk',
    object: 'chat.completion.chunk',
    created: 0,
    model: 'deepseek-chat',
    choices: [
      {
        index: 0,
        delta: choice.delta ?? {},
        finish_reason: choice.finish_reason ?? null,
        logprobs: null,
      },
    ],
  }
}

async function collectStream(
  chunks: ChatCompletionChunk[],
): Promise<Array<{ type: string; text?: string; content?: unknown }>> {
  async function* stream() {
    for (const chunk of chunks) {
      yield chunk
    }
  }

  const events = []
  for await (const event of parseOpenAIStream(stream())) {
    events.push(event)
  }
  return events
}

describe('parseOpenAIStream', () => {
  test('yields text_delta events and final assistant text message', async () => {
    const events = await collectStream([
      makeChunk({ delta: { content: '你' } }),
      makeChunk({ delta: { content: '好' } }),
      makeChunk({ delta: {}, finish_reason: 'stop' }),
    ])

    expect(events).toEqual([
      { type: 'text_delta', text: '你' },
      { type: 'text_delta', text: '好' },
      {
        type: 'assistant',
        content: [{ type: 'text', text: '你好' }],
      },
    ])
  })

  test('assembles fragmented tool_calls into assistant tool_use blocks', async () => {
    const events = await collectStream([
      makeChunk({
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'Echo', arguments: '' },
            },
          ],
        },
      }),
      makeChunk({
        delta: {
          tool_calls: [
            {
              index: 0,
              function: { arguments: '{"message":' },
            },
          ],
        },
      }),
      makeChunk({
        delta: {
          tool_calls: [
            {
              index: 0,
              function: { arguments: '"hi"}' },
            },
          ],
        },
      }),
      makeChunk({ delta: {}, finish_reason: 'tool_calls' }),
    ])

    expect(events).toEqual([
      {
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'Echo',
            input: { message: 'hi' },
          },
        ],
      },
    ])
  })
})
