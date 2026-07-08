import { describe, expect, test } from 'bun:test'
import { EchoTool } from '../EchoTool.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'

describe('EchoTool', () => {
  test('returns the same message string', async () => {
    const result = await EchoTool.call(
      { message: '测试' },
      createMinimalToolContext(),
    )
    expect(result.data).toBe('测试')
  })

  test('is read-only and concurrency-safe', () => {
    expect(EchoTool.isReadOnly({ message: 'x' })).toBe(true)
    expect(EchoTool.isConcurrencySafe({ message: 'x' })).toBe(true)
  })
})
