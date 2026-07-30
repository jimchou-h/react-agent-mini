import { describe, expect, test } from 'bun:test'
import { createUserMessage } from '../../../utils/messages.js'
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  estimateContextUsage,
  formatContextUsage,
  resolveContextWindowTokens,
} from '../contextUsage.js'

describe('estimateContextUsage', () => {
  test('uses API usage tokens when provided', () => {
    const result = estimateContextUsage([], {
      usage: {
        input_tokens: 12_800,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      windowTokens: 128_000,
    })
    expect(result.source).toBe('usage')
    expect(result.usedTokens).toBe(12_800)
    expect(result.windowTokens).toBe(128_000)
    expect(result.usedPercent).toBe(10)
  })

  test('falls back to char estimate when usage missing', () => {
    const messages = [createUserMessage('x'.repeat(400))]
    const result = estimateContextUsage(messages, { windowTokens: 100 })
    expect(result.source).toBe('chars')
    // 400 chars ≈ 100 tokens at /4 → 100%
    expect(result.usedTokens).toBe(100)
    expect(result.usedPercent).toBe(100)
  })

  test('clamps percent to 0..100', () => {
    const result = estimateContextUsage([], {
      usage: { input_tokens: 999_999 },
      windowTokens: 1000,
    })
    expect(result.usedPercent).toBe(100)
  })

  test('sums cache tokens into usage total', () => {
    const result = estimateContextUsage([], {
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 50,
      },
      windowTokens: 1000,
    })
    expect(result.usedTokens).toBe(200)
    expect(result.usedPercent).toBe(20)
  })
})

describe('formatContextUsage', () => {
  test('formats approximate percent line', () => {
    expect(
      formatContextUsage({
        usedPercent: 42,
        source: 'chars',
        usedTokens: 1,
        windowTokens: 100,
      }),
    ).toBe('ctx ~42%')
  })
})

describe('resolveContextWindowTokens', () => {
  test('defaults to DEFAULT_CONTEXT_WINDOW_TOKENS', () => {
    const prev = process.env.CONTEXT_WINDOW_TOKENS
    delete process.env.CONTEXT_WINDOW_TOKENS
    try {
      expect(resolveContextWindowTokens()).toBe(DEFAULT_CONTEXT_WINDOW_TOKENS)
    } finally {
      if (prev != null) process.env.CONTEXT_WINDOW_TOKENS = prev
    }
  })

  test('reads CONTEXT_WINDOW_TOKENS env', () => {
    const prev = process.env.CONTEXT_WINDOW_TOKENS
    process.env.CONTEXT_WINDOW_TOKENS = '64000'
    try {
      expect(resolveContextWindowTokens()).toBe(64_000)
    } finally {
      if (prev == null) delete process.env.CONTEXT_WINDOW_TOKENS
      else process.env.CONTEXT_WINDOW_TOKENS = prev
    }
  })
})
