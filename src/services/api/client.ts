import OpenAI from 'openai'
import type { CallModelParams } from '../../query/types.js'
import type { AssistantMessage, StreamEvent } from '../../types/message.js'
import { messagesToOpenAI, toolsToOpenAI } from './openai/adapter.js'
import { parseOpenAIStream } from './openai/stream.js'
import { trace } from '../../utils/trace.js'

export type OpenAIConfig = {
  apiKey: string
  baseURL: string
  model: string
}

/**
 * 从环境变量读取 DeepSeek / OpenAI 兼容配置
 */
export function readOpenAIConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAIConfig {
  return {
    apiKey: env.OPENAI_API_KEY ?? '',
    baseURL: env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
    model: env.OPENAI_MODEL ?? 'deepseek-chat',
  }
}

/**
 * 校验 API Key 是否存在；callModel 与 CLI 共用
 */
export function assertOpenAIApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY，请配置环境变量后重试。')
  }
}

/** TRACE=1：API 请求摘要（禁止传入密钥） */
export function emitApiRequestTrace(detail: {
  messages: CallModelParams['messages']
  tools: CallModelParams['tools']
  model: string
}): void {
  trace('api.request', {
    messages: detail.messages.length,
    tools: detail.tools.length,
    model: detail.model,
  })
}

let cachedClient: OpenAI | undefined

function getOpenAIClient(config: OpenAIConfig): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    })
  }
  return cachedClient
}

/**
 * 真实 DeepSeek Provider 入口 — 对齐 query/deps.CallModel 签名
 *
 * 流式调用 chat completions，yield text_delta 与 assistant 消息。
 */
export async function* callModel(
  params: CallModelParams,
): AsyncGenerator<StreamEvent | AssistantMessage> {
  const config = readOpenAIConfig()
  assertOpenAIApiKey(config.apiKey)

  const client = getOpenAIClient(config)
  const messages = messagesToOpenAI(params.messages)
  const tools = toolsToOpenAI(params.tools)

  emitApiRequestTrace({
    messages: params.messages,
    tools: params.tools,
    model: config.model,
  })

  const stream = await client.chat.completions.create(
    {
      model: config.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
    },
    { signal: params.signal },
  )

  yield* parseOpenAIStream(stream)
}

/** 测试用：重置单例客户端 */
export function resetOpenAIClientForTests(): void {
  cachedClient = undefined
}
