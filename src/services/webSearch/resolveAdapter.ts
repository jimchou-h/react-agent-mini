/**
 * 解析默认 / 测试覆盖的 WebSearch adapter
 *
 * 选择顺序：
 * 1. 测试 override
 * 2. WEB_SEARCH_ADAPTER=brave|tavily（显式）
 * 3. 仅有 TAVILY_API_KEY → tavily
 * 4. 默认 brave
 */

import { createBraveWebSearchAdapter, readBraveApiKey } from './braveAdapter.js'
import { createTavilyWebSearchAdapter, readTavilyApiKey } from './tavilyAdapter.js'
import type { WebSearchAdapter } from './types.js'

export type WebSearchAdapterKey = 'brave' | 'tavily'

let overrideAdapter: WebSearchAdapter | undefined

/** 测试注入；传 undefined 清除 */
export function setWebSearchAdapterForTests(
  adapter: WebSearchAdapter | undefined,
): void {
  overrideAdapter = adapter
}

export function resolveWebSearchAdapterKey(
  env: Record<string, string | undefined> = process.env,
): WebSearchAdapterKey {
  const explicit = env.WEB_SEARCH_ADAPTER?.trim().toLowerCase()
  if (explicit === 'brave' || explicit === 'tavily') {
    return explicit
  }
  if (readTavilyApiKey(env) && !readBraveApiKey(env)) {
    return 'tavily'
  }
  return 'brave'
}

export function resolveWebSearchAdapter(
  env: Record<string, string | undefined> = process.env,
): WebSearchAdapter {
  if (overrideAdapter) return overrideAdapter
  const key = resolveWebSearchAdapterKey(env)
  return key === 'tavily'
    ? createTavilyWebSearchAdapter(env)
    : createBraveWebSearchAdapter(env)
}
