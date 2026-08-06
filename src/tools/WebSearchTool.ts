/**
 * WebSearch 工具：联网搜索（对齐 CC WebSearch 精简版，默认 Brave）
 */

import { z } from 'zod'
import type { Tool, ToolUseContext } from '../Tool.js'
import { resolveWebSearchAdapter } from '../services/webSearch/resolveAdapter.js'
import { WebSearchConfigError } from '../services/webSearch/types.js'
import type { WebSearchHit } from '../services/webSearch/types.js'

export const WEB_SEARCH_TOOL_NAME = 'WebSearch'

const webSearchInputSchema = z.object({
  query: z.string().min(1).describe('The search query to use'),
  allowed_domains: z
    .array(z.string())
    .optional()
    .describe('Only include search results from these domains'),
  blocked_domains: z
    .array(z.string())
    .optional()
    .describe('Never include search results from these domains'),
  num_results: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Number of search results to return (default: 8)'),
})

function formatHits(query: string, hits: WebSearchHit[]): string {
  if (hits.length === 0) {
    return `No results for: ${query}`
  }
  const lines = hits.map((h, i) => {
    const snip = h.snippet ? `\n  ${h.snippet}` : ''
    return `${i + 1}. ${h.title}\n  ${h.url}${snip}`
  })
  return `Web search results for "${query}":\n\n${lines.join('\n\n')}`
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { name?: string }).name === 'AbortError'
  )
}

export const WebSearchTool: Tool<typeof webSearchInputSchema> = {
  name: WEB_SEARCH_TOOL_NAME,
  description:
    'Search the web for up-to-date information; returns titles, URLs, and snippets',
  inputSchema: webSearchInputSchema,

  async call(args, context: ToolUseContext) {
    const adapter = resolveWebSearchAdapter()
    try {
      const hits = await adapter.search(args.query, {
        signal: context.abortController?.signal,
        numResults: args.num_results,
        allowedDomains: args.allowed_domains,
        blockedDomains: args.blocked_domains,
      })
      return { data: formatHits(args.query, hits) }
    } catch (err) {
      if (err instanceof WebSearchConfigError) {
        return { data: err.message, isError: true }
      }
      if (isAbortError(err) || context.abortController?.signal.aborted) {
        return { data: 'WebSearch aborted', isError: true }
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `WebSearch failed: ${msg}`, isError: true }
    }
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  isEnabled() {
    return true
  },
}
