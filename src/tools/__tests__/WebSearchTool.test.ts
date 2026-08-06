import { afterEach, describe, expect, test } from 'bun:test'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { getTools } from '../index.js'
import { WebSearchTool, WEB_SEARCH_TOOL_NAME } from '../WebSearchTool.js'
import { createBraveWebSearchAdapter } from '../../services/webSearch/braveAdapter.js'
import { createHangingWebSearchAdapter } from '../../services/webSearch/hangingAdapter.js'
import { createMockWebSearchAdapter } from '../../services/webSearch/mockAdapter.js'
import { setWebSearchAdapterForTests } from '../../services/webSearch/resolveAdapter.js'
import { WebSearchConfigError } from '../../services/webSearch/types.js'

afterEach(() => {
  setWebSearchAdapterForTests(undefined)
})

describe('WebSearchTool', () => {
  test('getTools includes WebSearch', () => {
    expect(getTools().some(t => t.name === WEB_SEARCH_TOOL_NAME)).toBe(true)
  })

  test('mock adapter success returns title and url', async () => {
    setWebSearchAdapterForTests(
      createMockWebSearchAdapter([
        {
          title: 'Bun docs',
          url: 'https://bun.sh',
          snippet: 'Bun is fast',
        },
      ]),
    )

    const result = await WebSearchTool.call(
      { query: 'bun runtime' },
      createMinimalToolContext(),
    )

    expect(result.isError).toBeUndefined()
    expect(String(result.data)).toContain('Bun docs')
    expect(String(result.data)).toContain('https://bun.sh')
    expect(String(result.data)).toContain('bun runtime')
  })

  test('missing Brave API key returns is_error', async () => {
    setWebSearchAdapterForTests(createBraveWebSearchAdapter({}))

    const result = await WebSearchTool.call(
      { query: 'anything' },
      createMinimalToolContext(),
    )

    expect(result.isError).toBe(true)
    expect(String(result.data)).toMatch(/BRAVE_API_KEY/)
  })

  test('brave adapter throws WebSearchConfigError without key', async () => {
    const adapter = createBraveWebSearchAdapter({})
    await expect(adapter.search('q')).rejects.toBeInstanceOf(WebSearchConfigError)
  })

  test('aborts when signal aborted during search', async () => {
    setWebSearchAdapterForTests(createHangingWebSearchAdapter())
    const abortController = new AbortController()
    const pending = WebSearchTool.call(
      { query: 'slow' },
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
