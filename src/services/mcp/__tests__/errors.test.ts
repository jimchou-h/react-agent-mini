import { describe, expect, test } from 'bun:test'
import { formatMcpFailure } from '../errors.js'

describe('formatMcpFailure', () => {
  test('formats prompt failure with detail', () => {
    expect(formatMcpFailure('prompt', 'timeout')).toBe(
      'MCP prompt 失败: timeout',
    )
  })

  test('formats resource failure with detail', () => {
    expect(formatMcpFailure('resource', 'not found')).toBe(
      'MCP resource 失败: not found',
    )
  })

  test('uses fallback when detail empty', () => {
    expect(formatMcpFailure('prompt', '  ')).toBe('MCP prompt 失败: 未知错误')
  })
})
