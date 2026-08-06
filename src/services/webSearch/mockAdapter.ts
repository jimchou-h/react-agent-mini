/**
 * 测试用 mock adapter
 */

import type { WebSearchAdapter, WebSearchHit, WebSearchOptions } from './types.js'

export function createMockWebSearchAdapter(
  hits: WebSearchHit[] = [
    {
      title: 'Example',
      url: 'https://example.com',
      snippet: 'An example result',
    },
  ],
): WebSearchAdapter {
  return {
    async search(
      query: string,
      options?: WebSearchOptions,
    ): Promise<WebSearchHit[]> {
      if (options?.signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }
      return hits.map(h => ({
        ...h,
        title: `${h.title} — ${query}`,
      }))
    },
  }
}
