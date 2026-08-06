/**
 * WebFetch：URL 护栏 + HTTP 拉取 + 简单去标签
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 30_000
export const DEFAULT_MAX_BYTES = 512 * 1024

export class WebFetchUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebFetchUrlError'
  }
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
])

function isPrivateIpv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!m) return false
  const parts = m.slice(1).map(Number)
  if (parts.some(n => n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/** 校验并返回规范化 URL；不安全则抛 WebFetchUrlError */
export function assertSafeFetchUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new WebFetchUrlError(`Invalid URL: ${raw}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebFetchUrlError(
      `Only http(s) URLs are allowed (got ${url.protocol})`,
    )
  }

  const host = url.hostname.toLowerCase()
  if (host === '::1' || host.endsWith('.localhost')) {
    throw new WebFetchUrlError(`Blocked host: ${url.hostname}`)
  }
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host)) {
    throw new WebFetchUrlError(`Blocked host: ${url.hostname}`)
  }

  return url
}

/** 粗暴去 HTML 标签，压空白 */
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text
}

export type FetchUrlResult = {
  url: string
  contentType: string
  text: string
  truncated: boolean
}

/** 可注入的 fetch 子集（避免要求 `typeof fetch` 的 preconnect 等） */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

export type FetchUrlOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  maxBytes?: number
  /** 测试可注入 */
  fetchImpl?: FetchLike
}

export async function fetchUrlText(
  rawUrl: string,
  options: FetchUrlOptions = {},
): Promise<FetchUrlResult> {
  const url = assertSafeFetchUrl(rawUrl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const fetchImpl = options.fetchImpl ?? fetch

  if (options.signal?.aborted) {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    throw err
  }

  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout

  const res = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    signal,
    headers: { Accept: 'text/html,text/plain,*/*' },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url.href}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  const buf = new Uint8Array(await res.arrayBuffer())
  let truncated = false
  let bytes = buf
  if (bytes.byteLength > maxBytes) {
    bytes = bytes.slice(0, maxBytes)
    truncated = true
  }

  const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const isHtml = /html/i.test(contentType) || /^\s*</.test(rawText)
  const text = isHtml ? htmlToText(rawText) : rawText.trim()

  return {
    url: url.href,
    contentType,
    text,
    truncated,
  }
}
