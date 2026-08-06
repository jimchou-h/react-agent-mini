/**
 * Tavily Search API adapter
 *
 * env: TAVILY_API_KEY
 * optional: TAVILY_ENDPOINT_URL（默认 https://api.tavily.com/search）
 */

import { filterHitsByDomains } from './filterDomains.js'
import type { WebSearchAdapter, WebSearchHit, WebSearchOptions } from './types.js'
import { WebSearchConfigError } from './types.js'

const DEFAULT_TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const DEFAULT_NUM_RESULTS = 8
const FETCH_TIMEOUT_MS = 30_000

export function readTavilyApiKey(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.TAVILY_API_KEY?.trim() || ''
}

export function resolveTavilySearchUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.TAVILY_ENDPOINT_URL?.trim() || DEFAULT_TAVILY_SEARCH_URL
  if (raw.endsWith('/search')) return raw
  return `${raw.replace(/\/$/, '')}/search`
}

type TavilyHit = {
  title?: string
  url?: string
  content?: string
}

type TavilySearchResponse = {
  results?: TavilyHit[]
}

export function createTavilyWebSearchAdapter(
  env: Record<string, string | undefined> = process.env,
): WebSearchAdapter {
  return {
    async search(
      query: string,
      options: WebSearchOptions = {},
    ): Promise<WebSearchHit[]> {
      const apiKey = readTavilyApiKey(env)
      if (!apiKey) {
        throw new WebSearchConfigError(
          '缺少 TAVILY_API_KEY，无法使用 WebSearch（Tavily）',
        )
      }

      if (options.signal?.aborted) {
        const err = new Error('Aborted')
        err.name = 'AbortError'
        throw err
      }

      const num = options.numResults ?? DEFAULT_NUM_RESULTS
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout

      const res = await fetch(resolveTavilySearchUrl(env), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: Math.min(Math.max(num, 1), 20),
          include_domains: options.allowedDomains ?? [],
          exclude_domains: options.blockedDomains ?? [],
        }),
      })

      if (!res.ok) {
        throw new Error(`Tavily Search HTTP ${res.status}`)
      }

      const body = (await res.json()) as TavilySearchResponse
      const hits: WebSearchHit[] = (body.results ?? [])
        .filter(r => r.title && r.url)
        .map(r => ({
          title: r.title!,
          url: r.url!,
          snippet: r.content,
        }))

      // Tavily 已支持 include/exclude_domains；再本地过滤一次作兜底
      return filterHitsByDomains(
        hits,
        options.allowedDomains,
        options.blockedDomains,
      )
    },
  }
}
