import { afterEach, describe, expect, test } from 'bun:test'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import {
  BashTool,
  MAX_BASH_OUTPUT_CHARS,
  setResolveBashExecutableForTests,
} from '../BashTool.js'

const ctx = () => createMinimalToolContext([BashTool])

afterEach(() => {
  setResolveBashExecutableForTests(undefined)
})

describe('BashTool', () => {
  test(
    'runs a command and returns stdout',
    async () => {
      const result = await BashTool.call({ command: 'echo hello-bash' }, ctx())
      expect(result.isError).toBeUndefined()
      expect(String(result.data)).toContain('hello-bash')
    },
    { timeout: 30_000 },
  )

  test(
    'runs Unix compound command (works via Git Bash on Windows)',
    async () => {
      const result = await BashTool.call(
        { command: 'echo ok && true' },
        ctx(),
      )
      expect(result.isError).toBeUndefined()
      expect(String(result.data)).toContain('ok')
    },
    { timeout: 30_000 },
  )

  test(
    'non-zero exit code is reported as error but keeps output',
    async () => {
      const result = await BashTool.call(
        { command: 'echo oops && exit 3' },
        ctx(),
      )
      expect(result.isError).toBe(true)
      expect(String(result.data)).toContain('oops')
      expect(String(result.data)).toContain('3')
    },
    { timeout: 30_000 },
  )

  test(
    'times out and marks error',
    async () => {
      const result = await BashTool.call(
        { command: 'sleep 5', timeout: 300 },
        ctx(),
      )
      expect(result.isError).toBe(true)
      expect(String(result.data)).toMatch(/超时|timeout/i)
    },
    { timeout: 30_000 },
  )

  test(
    'accepts deprecated timeout_ms alias',
    async () => {
      const result = await BashTool.call(
        { command: 'sleep 5', timeout_ms: 300 },
        ctx(),
      )
      expect(result.isError).toBe(true)
    },
    { timeout: 30_000 },
  )

  test(
    'truncates oversized output',
    async () => {
      const result = await BashTool.call(
        {
          command: 'for i in $(seq 1 20000); do echo AAAAAAAAAA; done',
        },
        ctx(),
      )
      expect(String(result.data).length).toBeLessThanOrEqual(
        MAX_BASH_OUTPUT_CHARS + 200,
      )
      expect(String(result.data)).toMatch(/截断|truncat/i)
    },
    { timeout: 60_000 },
  )

  test('is not read-only', () => {
    expect(BashTool.isReadOnly({ command: 'echo x' })).toBe(false)
  })

  test('description requires Unix/bash syntax', () => {
    expect(BashTool.description).toMatch(/Unix|bash/i)
    expect(BashTool.description).toMatch(/Windows/i)
  })

  test('missing Git Bash returns isError without spawning cmd', async () => {
    setResolveBashExecutableForTests(() => null)
    const result = await BashTool.call({ command: 'echo should-not-run' }, ctx())
    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/Git Bash|CLAUDE_CODE_GIT_BASH_PATH/i)
    expect(String(result.data)).not.toContain('should-not-run')
  })
})
