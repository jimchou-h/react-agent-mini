import { afterEach, describe, expect, test } from 'bun:test'
import { isTraceEnabled, trace } from '../trace.js'

describe('isTraceEnabled', () => {
  const prev = process.env.TRACE

  afterEach(() => {
    if (prev === undefined) delete process.env.TRACE
    else process.env.TRACE = prev
  })

  test('returns false when TRACE is unset', () => {
    delete process.env.TRACE
    expect(isTraceEnabled()).toBe(false)
  })

  test('returns true only when TRACE is exactly 1', () => {
    process.env.TRACE = '1'
    expect(isTraceEnabled()).toBe(true)

    process.env.TRACE = 'true'
    expect(isTraceEnabled()).toBe(false)
  })
})

describe('trace', () => {
  const prev = process.env.TRACE
  const originalError = console.error
  const lines: unknown[][] = []

  afterEach(() => {
    console.error = originalError
    lines.length = 0
    if (prev === undefined) delete process.env.TRACE
    else process.env.TRACE = prev
  })

  test('writes nothing to console.error when TRACE is unset', () => {
    delete process.env.TRACE
    console.error = (...args: unknown[]) => {
      lines.push(args)
    }

    trace('cli.start', { mode: 'headless' })

    expect(lines).toEqual([])
  })

  test('writes [trace] structured line when TRACE=1', () => {
    process.env.TRACE = '1'
    console.error = (...args: unknown[]) => {
      lines.push(args)
    }

    trace('cli.start', { mode: 'headless' })

    expect(lines).toHaveLength(1)
    const line = String(lines[0]![0])
    expect(line.startsWith('[trace]')).toBe(true)
    expect(line).toContain('cli.start')
    expect(line).toContain('mode=headless')
  })
})
