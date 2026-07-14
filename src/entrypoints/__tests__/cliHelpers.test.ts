import { describe, expect, test } from 'bun:test'
import {
  formatToolResultStatus,
  formatToolStartStatus,
  isMockMode,
  parseUserPrompt,
} from '../cliHelpers.js'

describe('parseUserPrompt', () => {
  test('parses text after --', () => {
    expect(parseUserPrompt(['--', '你好'])).toBe('你好')
  })

  test('parses positional args without --', () => {
    expect(parseUserPrompt(['用', 'Echo', '回复', 'hello'])).toBe('用 Echo 回复 hello')
  })

  test('returns null for pipe mode -p', () => {
    expect(parseUserPrompt(['-p'])).toBeNull()
  })

  test('filters mock flags from prompt after --', () => {
    expect(parseUserPrompt(['--mock', '--', '问题'])).toBe('问题')
  })
})

describe('isMockMode', () => {
  test('detects --mock flag', () => {
    expect(isMockMode(['--mock', '--', 'hi'])).toBe(true)
  })

  test('detects QUERY_MOCK env', () => {
    const prev = process.env.QUERY_MOCK
    process.env.QUERY_MOCK = '1'
    try {
      expect(isMockMode([])).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.QUERY_MOCK
      else process.env.QUERY_MOCK = prev
    }
  })
})

describe('formatToolStartStatus', () => {
  test('formats Read tool status', () => {
    expect(
      formatToolStartStatus({
        type: 'tool_use',
        id: 'toolu_1',
        name: 'Read',
        input: { path: 'README.md' },
      }),
    ).toBe('[工具] Read: README.md')
  })

  test('formats Echo tool status', () => {
    expect(
      formatToolStartStatus({
        type: 'tool_use',
        id: 'toolu_2',
        name: 'Echo',
        input: { message: 'hello' },
      }),
    ).toBe('[工具] Echo: hello')
  })

  test('formats Grep tool status', () => {
    expect(
      formatToolStartStatus({
        type: 'tool_use',
        id: 'toolu_3',
        name: 'Grep',
        input: { pattern: 'foo' },
      }),
    ).toBe('[工具] Grep: foo')
  })
})
describe('formatToolResultStatus', () => {
  test('returns null for success', () => {
    expect(
      formatToolResultStatus({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: 'ok',
      }),
    ).toBeNull()
  })

  test('returns error line for failures', () => {
    expect(
      formatToolResultStatus({
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: '文件不存在',
        is_error: true,
      }),
    ).toBe('[工具] 错误 — 文件不存在')
  })
})
