/**
 * 可挂起直至 abort 的 mock（测 signal）
 */

import type { WebSearchAdapter, WebSearchOptions } from './types.js'

export function createHangingWebSearchAdapter(): WebSearchAdapter {
  return {
    async search(_query: string, options?: WebSearchOptions) {
      await new Promise<void>((_resolve, reject) => {
        const fail = () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        }
        if (options?.signal?.aborted) {
          fail()
          return
        }
        options?.signal?.addEventListener('abort', fail, { once: true })
      })
      // abort 路径会 reject；此处不可达，仅满足类型
      throw new Error('Hanging adapter resolved without abort')
    },
  }
}
