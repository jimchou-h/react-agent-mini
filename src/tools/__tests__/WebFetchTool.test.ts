import { afterEach, describe, expect, test } from 'bun:test'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import {
  assertSafeFetchUrl,
  htmlToText,
  WebFetchUrlError,
} from '../../services/webFetch/fetchUrl.js'
import { getTools } from '../index.js'
import {
  setWebFetchImplForTests,
  WebFetchTool,
  WEB_FETCH_TOOL_NAME,
} from '../WebFetchTool.js'

afterEach(() => {
  setWebFetchImplForTests(undefined)
})

describe('assertSafeFetchUrl / htmlToText', () => {
  test('allows https URL', () => {
    expect(assertSafeFetchUrl('https://example.com/a').href).toBe(
      'https://example.com/a',
    )
  })

  test('rejects non-http schemes', () => {
    expect(() => assertSafeFetchUrl('file:///etc/passwd')).toThrow(
      WebFetchUrlError,
    )
  })

  test('rejects localhost and private IPs', () => {
    expect(() => assertSafeFetchUrl('http://127.0.0.1/')).toThrow(
      WebFetchUrlError,
    )
    expect(() => assertSafeFetchUrl('http://192.168.1.1/')).toThrow(
      WebFetchUrlError,
    )
    expect(() => assertSafeFetchUrl('http://169.254.169.254/latest')).toThrow(
      WebFetchUrlError,
    )
  })

  test('strips html tags', () => {
    expect(htmlToText('<p>Hello <b>world</b></p>')).toContain('Hello world')
  })
})

describe('WebFetchTool', () => {
  test('getTools includes WebFetch', () => {
    expect(getTools().some(t => t.name === WEB_FETCH_TOOL_NAME)).toBe(true)
  })

  test('successful fetch returns text body', async () => {
    setWebFetchImplForTests(async () => {
      return new Response('<html><body><h1>Title</h1><p>Hello</p></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    })

    const result = await WebFetchTool.call(
      { url: 'https://example.com/page' },
      createMinimalToolContext(),
    )

    expect(result.isError).toBeUndefined()
    expect(String(result.data)).toContain('https://example.com/page')
    expect(String(result.data)).toContain('Hello')
  })

  test('SSRF / blocked URL returns is_error without fetch', async () => {
    let fetched = false
    setWebFetchImplForTests(async () => {
      fetched = true
      return new Response('nope')
    })

    const result = await WebFetchTool.call(
      { url: 'http://127.0.0.1/secret' },
      createMinimalToolContext(),
    )

    expect(fetched).toBe(false)
    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/Blocked|http/i)
  })

  test('aborts when signal aborted during fetch', async () => {
    setWebFetchImplForTests(async (_url, init): Promise<Response> => {
      const signal = init?.signal
      await new Promise<void>((_resolve, reject) => {
        const fail = () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (signal?.aborted) {
          fail()
          return
        }
        signal?.addEventListener('abort', fail, { once: true })
      })
      throw new Error('unreachable')
    })

    const abortController = new AbortController()
    const pending = WebFetchTool.call(
      { url: 'https://example.com/slow' },
      {
        ...createMinimalToolContext(),
        abortController,
      },
    )
    abortController.abort('interrupt')
    const result = await pending
    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/abort/i)
  })
})
