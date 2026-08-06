/**
 * WebSearch 结果按域名白/黑名单过滤
 */

import type { WebSearchHit } from './types.js'

export function filterHitsByDomains(
  hits: WebSearchHit[],
  allowed?: string[],
  blocked?: string[],
): WebSearchHit[] {
  let out = hits
  if (allowed && allowed.length > 0) {
    const allow = new Set(allowed.map(d => d.toLowerCase()))
    out = out.filter(h => {
      try {
        return allow.has(new URL(h.url).hostname.toLowerCase())
      } catch {
        return false
      }
    })
  }
  if (blocked && blocked.length > 0) {
    const block = new Set(blocked.map(d => d.toLowerCase()))
    out = out.filter(h => {
      try {
        return !block.has(new URL(h.url).hostname.toLowerCase())
      } catch {
        return false
      }
    })
  }
  return out
}
