import { describe, expect, test } from 'bun:test'
import { resolveLaunchMode } from '../cliHelpers.js'

describe('resolveLaunchMode', () => {
  test('returns repl when no prompt and not pipe', () => {
    expect(resolveLaunchMode([])).toBe('repl')
    expect(resolveLaunchMode(['--mock'])).toBe('repl')
  })

  test('returns headless when user prompt is present', () => {
    expect(resolveLaunchMode(['--', '你好'])).toBe('headless')
    expect(resolveLaunchMode(['问个问题'])).toBe('headless')
  })

  test('returns pipe when -p is set', () => {
    expect(resolveLaunchMode(['-p'])).toBe('pipe')
    expect(resolveLaunchMode(['--mock', '-p'])).toBe('pipe')
  })
})
