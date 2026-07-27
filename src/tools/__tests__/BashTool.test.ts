import { describe, expect, test } from 'bun:test'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { BashTool, MAX_BASH_OUTPUT_CHARS } from '../BashTool.js'

const ctx = () => createMinimalToolContext([BashTool])

describe('BashTool', () => {
  test('runs a command and returns stdout', async () => {
    const result = await BashTool.call({ command: 'echo hello-bash' }, ctx())
    expect(result.isError).toBeUndefined()
    expect(String(result.data)).toContain('hello-bash')
  })

  test('non-zero exit code is reported as error but keeps output', async () => {
    const result = await BashTool.call(
      { command: 'echo oops && exit 3' },
      ctx(),
    )
    expect(result.isError).toBe(true)
    expect(String(result.data)).toContain('oops')
    expect(String(result.data)).toContain('3')
  })

  test('times out and marks error', async () => {
    const cmd =
      process.platform === 'win32'
        ? 'ping -n 6 127.0.0.1 > NUL'
        : 'sleep 5'
    const result = await BashTool.call(
      { command: cmd, timeout: 300 },
      ctx(),
    )
    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/超时|timeout/i)
  })

  test('accepts deprecated timeout_ms alias', async () => {
    const cmd =
      process.platform === 'win32'
        ? 'ping -n 6 127.0.0.1 > NUL'
        : 'sleep 5'
    const result = await BashTool.call(
      { command: cmd, timeout_ms: 300 },
      ctx(),
    )
    expect(result.isError).toBe(true)
  })

  test('truncates oversized output', async () => {
    const cmd =
      process.platform === 'win32'
        ? `for /L %i in (1,1,20000) do @echo AAAAAAAAAA`
        : `for i in $(seq 1 20000); do echo AAAAAAAAAA; done`
    const result = await BashTool.call({ command: cmd }, ctx())
    expect(String(result.data).length).toBeLessThanOrEqual(
      MAX_BASH_OUTPUT_CHARS + 200,
    )
    expect(String(result.data)).toMatch(/截断|truncat/i)
  })

  test('is not read-only', () => {
    expect(BashTool.isReadOnly({ command: 'echo x' })).toBe(false)
  })
})
