import type { ChatCompletionChunk } from 'openai/resources/chat/completions'
import type { AssistantMessage, StreamEvent } from '../../../types/message.js'
import { createAssistantMessage } from '../../../utils/messages.js'
import { trace } from '../../../utils/trace.js'

type ToolCallAccumulator = {
  id: string
  name: string
  arguments: string
}

/**
 * 解析 OpenAI 流式 chat completions chunk，转为内部 StreamEvent / AssistantMessage
 *
 * - text delta → yield { type: 'text_delta' }
 * - tool_calls 分片 → 按 index 累积，结束时 yield assistant(tool_use)
 * - 纯文本结束 → yield assistant(text)
 */
export async function* parseOpenAIStream(
  stream: AsyncIterable<ChatCompletionChunk>,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  let text = ''
  const toolCalls = new Map<number, ToolCallAccumulator>()

  for await (const chunk of stream) {
    const choice = chunk.choices[0]
    if (!choice) continue

    const delta = choice.delta

    if (delta.content) {
      text += delta.content
      yield { type: 'text_delta', text: delta.content }
    }

    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        const index = toolCall.index ?? 0
        let current = toolCalls.get(index)

        if (!current) {
          current = {
            id: toolCall.id ?? `toolu_${index}`,
            name: toolCall.function?.name ?? '',
            arguments: '',
          }
          toolCalls.set(index, current)
        }

        if (toolCall.id) {
          current.id = toolCall.id
        }
        if (toolCall.function?.name) {
          current.name = toolCall.function.name
        }
        if (toolCall.function?.arguments) {
          current.arguments += toolCall.function.arguments
        }
      }
    }

    if (choice.finish_reason) {
      if (toolCalls.size > 0) {
        const content = [...toolCalls.values()].map(toolCall => ({
          type: 'tool_use' as const,
          id: toolCall.id,
          name: toolCall.name,
          input: parseToolArguments(toolCall.arguments),
        }))
        trace('api.assistant', {
          kind: 'tool_use',
          tool_uses: content.length,
        })
        yield createAssistantMessage(content)
        return
      }

      if (text.length > 0) {
        trace('api.assistant', { kind: 'text', text_len: text.length })
        yield createAssistantMessage([{ type: 'text', text }])
      }
    }
  }
}

function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}
