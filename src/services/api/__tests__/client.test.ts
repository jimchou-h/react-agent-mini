import { afterEach, describe, expect, test } from 'bun:test'
import {
  assertOpenAIApiKey,
  emitApiRequestTrace,
  readOpenAIConfig,
} from '../client.js'

describe('readOpenAIConfig', () => {
  test('uses DeepSeek defaults when env vars are unset', () => {
    const config = readOpenAIConfig({
      OPENAI_API_KEY: 'sk-test',
    })

    expect(config).toEqual({
      apiKey: 'sk-test',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-chat',
    })
  })

  test('reads custom base URL and model from env', () => {
    const config = readOpenAIConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_BASE_URL: 'https://example.com/v1',
      OPENAI_MODEL: 'custom-model',
    })

    expect(config.baseURL).toBe('https://example.com/v1')
    expect(config.model).toBe('custom-model')
  })
})

describe('assertOpenAIApiKey', () => {
  test('throws readable error when API key is missing', () => {
    expect(() => assertOpenAIApiKey('')).toThrow('OPENAI_API_KEY')
  })
})

describe('emitApiRequestTrace', () => {
  const prev = process.env.TRACE
  const originalError = console.error

  afterEach(() => {
    console.error = originalError
    if (prev === undefined) delete process.env.TRACE
    else process.env.TRACE = prev
  })

  test('emits api.request counts without secrets when TRACE=1', () => {
    process.env.TRACE = '1'
    const lines: string[] = []
    console.error = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '))
    }

    emitApiRequestTrace({
      messages: [{ type: 'user', content: [{ type: 'text', text: 'hi' }] }],
      tools: [],
      model: 'deepseek-chat',
    })

    const joined = lines.join('\n')
    expect(joined).toContain('[trace]')
    expect(joined).toContain('api.request')
    expect(joined).toContain('messages=1')
    expect(joined).toContain('model=deepseek-chat')
    expect(joined).not.toContain('OPENAI_API_KEY')
    expect(joined).not.toMatch(/sk-[a-zA-Z0-9]+/)
  })
})
