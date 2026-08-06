/**
 * 解析默认 / 测试覆盖的 WebSearch adapter
 */

import { createBraveWebSearchAdapter } from './braveAdapter.js'
import type { WebSearchAdapter } from './types.js'

let overrideAdapter: WebSearchAdapter | undefined

/** 测试注入；传 undefined 清除 */
export function setWebSearchAdapterForTests(
  adapter: WebSearchAdapter | undefined,
): void {
  overrideAdapter = adapter
}

export function resolveWebSearchAdapter(): WebSearchAdapter {
  return overrideAdapter ?? createBraveWebSearchAdapter()
}
