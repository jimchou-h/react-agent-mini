/**
 * Brave Search API adapter
 *
 * env: BRAVE_API_KEY 或 BRAVE_SEARCH_API_KEY
 */

import { filterHitsByDomains } from './filterDomains.js'
import type { WebSearchAdapter, WebSearchHit, WebSearchOptions } from './types.js'
import { WebSearchConfigError } from './types.js'

const BRAVE_WEB_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search'
const DEFAULT_NUM_RESULTS = 8
const FETCH_TIMEOUT_MS = 30_000

export function readBraveApiKey(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.BRAVE_API_KEY?.trim() ||
    env.BRAVE_SEARCH_API_KEY?.trim() ||
    ''
  )
}

type BraveWebResult = {
  title?: string
  url?: string
  description?: string
}

type BraveWebSearchResponse = {
  web?: { results?: BraveWebResult[] }
}

export function createBraveWebSearchAdapter(
  env: Record<string, string | undefined> = process.env,
): WebSearchAdapter {
  return {
    async search(
      query: string,
      options: WebSearchOptions = {},
    ): Promise<WebSearchHit[]> {
      const apiKey = readBraveApiKey(env)
      if (!apiKey) {
        throw new WebSearchConfigError(
          '缺少 BRAVE_API_KEY（或 BRAVE_SEARCH_API_KEY），无法使用 WebSearch',
        )
      }

      if (options.signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }

      const num = options.numResults ?? DEFAULT_NUM_RESULTS
      const url = new URL(BRAVE_WEB_SEARCH_URL)
      url.searchParams.set('q', query)
      url.searchParams.set('count', String(Math.min(Math.max(num, 1), 20)))

      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
        signal,
      })

      if (!res.ok) {
        throw new Error(`Brave Search HTTP ${res.status}`)
      }

      const body = (await res.json()) as BraveWebSearchResponse
      const raw = body.web?.results ?? []
      const hits: WebSearchHit[] = raw
        .filter(r => r.title && r.url)
        .map(r => ({
          title: r.title!,
          url: r.url!,
          snippet: r.description,
        }))

      return filterHitsByDomains(
        hits,
        options.allowedDomains,
        options.blockedDomains,
      )
    },
  }
}
