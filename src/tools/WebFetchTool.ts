/**
 * WebFetch 工具：拉取 http(s) 页面正文（对齐 CC WebFetch 精简版）
 */

import { z } from 'zod'
import type { Tool, ToolUseContext } from '../Tool.js'
import {
  fetchUrlText,
  WebFetchUrlError,
  type FetchUrlOptions,
} from '../services/webFetch/fetchUrl.js'

export const WEB_FETCH_TOOL_NAME = 'WebFetch'

const webFetchInputSchema = z.object({
  url: z.string().min(1).describe('The URL to fetch'),
})

let fetchOverride: FetchUrlOptions['fetchImpl']

/** 测试注入 fetch；传 undefined 清除 */
export function setWebFetchImplForTests(
  impl: FetchUrlOptions['fetchImpl'] | undefined,
): void {
  fetchOverride = impl
}

function isAbortError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    (err as { name?: string }).name === 'AbortError'
  )
}

export const WebFetchTool: Tool<typeof webFetchInputSchema> = {
  name: WEB_FETCH_TOOL_NAME,
  description:
    'Fetch a URL and return readable text content (HTML stripped); respects size/timeout limits',
  inputSchema: webFetchInputSchema,

  async call(args, context: ToolUseContext) {
    try {
      const result = await fetchUrlText(args.url, {
        signal: context.abortController?.signal,
        fetchImpl: fetchOverride,
      })
      const note = result.truncated ? '\n\n[truncated]' : ''
      return {
        data: `Fetched ${result.url}\n\n${result.text}${note}`,
      }
    } catch (err) {
      if (err instanceof WebFetchUrlError) {
        return { data: err.message, isError: true }
      }
      if (isAbortError(err) || context.abortController?.signal.aborted) {
        return { data: 'WebFetch aborted', isError: true }
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { data: `WebFetch failed: ${msg}`, isError: true }
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
