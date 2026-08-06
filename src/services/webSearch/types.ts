/**
 * WebSearch adapter 契约（对齐 CC WebSearch 精简版）
 */

export type WebSearchHit = {
  title: string
  url: string
  snippet?: string
}

export type WebSearchOptions = {
  signal?: AbortSignal
  numResults?: number
  allowedDomains?: string[]
  blockedDomains?: string[]
}

export type WebSearchAdapter = {
  search(query: string, options?: WebSearchOptions): Promise<WebSearchHit[]>
}

export class WebSearchConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebSearchConfigError'
  }
}
