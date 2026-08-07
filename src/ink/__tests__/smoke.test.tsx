import { PassThrough } from 'node:stream'
import { describe, expect, test } from 'bun:test'
import React from 'react'
import { Text, createRoot } from '@anthropic/ink'

function mockWriteStream(): NodeJS.WriteStream {
  const stream = new PassThrough() as unknown as NodeJS.WriteStream
  Object.defineProperties(stream, {
    columns: { value: 80, writable: true },
    rows: { value: 24, writable: true },
    isTTY: { value: true, writable: true },
  })
  return stream
}

describe('@anthropic/ink smoke', () => {
  test('createRoot renders Text without throwing', async () => {
    const stdout = mockWriteStream()
    const stdin = new PassThrough() as unknown as NodeJS.ReadStream
    const stderr = mockWriteStream()

    const root = await createRoot({
      stdout,
      stdin,
      stderr,
      exitOnCtrlC: false,
      patchConsole: false,
    })

    expect(() => {
      root.render(React.createElement(Text, null, 'hi-from-ink'))
    }).not.toThrow()

    root.unmount()
  })
})
