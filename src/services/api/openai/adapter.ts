import { z } from 'zod'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import type { Tools } from '../../../Tool.js'
import type {
  AssistantMessage,
  ContentBlock,
  Message,
  UserMessage,
} from '../../../types/message.js'

/**
 * 将内部 Anthropic 形态消息转为 OpenAI Chat Completions messages
 *
 * 关键约束：同一 user 回合内，tool_result 必须先于 text 发出，
 * 否则 OpenAI API 会报 "insufficient tool messages following tool_calls"。
 */
export function messagesToOpenAI(
  messages: Message[],
  systemPrompt?: string,
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = []

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt })
  }

  for (const message of messages) {
    if (message.type === 'assistant') {
      result.push(convertAssistantMessage(message))
      continue
    }

    result.push(...convertUserMessage(message))
  }

  return result
}

function convertAssistantMessage(
  message: AssistantMessage,
): ChatCompletionMessageParam {
  const textParts: string[] = []
  const toolCalls: NonNullable<
    Extract<ChatCompletionMessageParam, { role: 'assistant' }>['tool_calls']
  > = []

  for (const block of message.content) {
    if (block.type === 'text') {
      textParts.push(block.text)
      continue
    }

    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      })
    }
  }

  if (toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: textParts.length > 0 ? textParts.join('') : null,
      tool_calls: toolCalls,
    }
  }

  return {
    role: 'assistant',
    content: textParts.join(''),
  }
}

function convertUserMessage(message: UserMessage): ChatCompletionMessageParam[] {
  const toolResults = message.content.filter(
    (block): block is Extract<ContentBlock, { type: 'tool_result' }> =>
      block.type === 'tool_result',
  )
  const textParts = message.content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)

  const result: ChatCompletionMessageParam[] = []

  for (const block of toolResults) {
    result.push({
      role: 'tool',
      tool_call_id: block.tool_use_id,
      content: block.content,
    })
  }

  if (textParts.length > 0) {
    result.push({
      role: 'user',
      content: textParts.join(''),
    })
  }

  return result
}

/**
 * 将 Tool 注册表转为 OpenAI tools 定义
 */
export function toolsToOpenAI(tools: Tools): ChatCompletionTool[] {
  return tools
    .filter(tool => tool.isEnabled())
    .map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters:
          tool.inputJsonSchema ?? zodObjectToJsonSchema(tool.inputSchema),
      },
    }))
}

function zodObjectToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  if (!(schema instanceof z.ZodObject)) {
    return { type: 'object', properties: {} }
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    const field = fieldSchema as z.ZodTypeAny
    const inner = unwrapOptional(field)
    if (inner instanceof z.ZodString) {
      properties[key] = {
        type: 'string',
        ...(inner.description ? { description: inner.description } : {}),
      }
    } else if (inner instanceof z.ZodNumber) {
      properties[key] = {
        type: 'number',
        ...(inner.description ? { description: inner.description } : {}),
      }
    }

    if (!(field instanceof z.ZodOptional)) {
      required.push(key)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

function unwrapOptional(field: z.ZodTypeAny): z.ZodTypeAny {
  if (field instanceof z.ZodOptional) {
    return field._def.innerType
  }
  return field
}
