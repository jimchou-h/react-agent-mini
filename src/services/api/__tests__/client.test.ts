import { describe, expect, test } from 'bun:test'
import { assertOpenAIApiKey, readOpenAIConfig } from '../client.js'

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
