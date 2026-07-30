/**
 * 上下文占用估算：优先 API usage，否则字符≈token。
 *
 * 供 REPL 展示 `ctx ~NN%` 与后续 autocompact 阈值判定复用。
 */

import type { Message } from '../../types/message.js'
import { estimateOutboundChars } from './compact.js'

/** 缺省上下文窗口（token）；可用 `CONTEXT_WINDOW_TOKENS` 覆盖 */
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000

/** 字符近似 token：约 4 字符 ≈ 1 token */
export const CHARS_PER_TOKEN_ESTIMATE = 4

/** 最近一次 API 返回的 token usage（OpenAI/Anthropic 兼容子集） */
export type TokenUsage = {
  input_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export type ContextUsageEstimate = {
  usedPercent: number
  source: 'usage' | 'chars'
  usedTokens: number
  windowTokens: number
}

export type EstimateContextUsageOptions = {
  usage?: TokenUsage | null
  windowTokens?: number
}

/** 解析上下文窗口大小：options → env → 默认 */
export function resolveContextWindowTokens(override?: number): number {
  if (override != null && override > 0) return override
  const raw = process.env.CONTEXT_WINDOW_TOKENS
  if (raw != null && /^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n > 0) return n
  }
  return DEFAULT_CONTEXT_WINDOW_TOKENS
}

function totalUsageTokens(usage: TokenUsage): number {
  return (
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  )
}

/**
 * 估算当前会话相对窗口的占用。
 * usage 有且 input 合计 > 0 时用 usage；否则用消息字符 / 4。
 */
export function estimateContextUsage(
  messages: Message[],
  options?: EstimateContextUsageOptions,
): ContextUsageEstimate {
  const windowTokens = resolveContextWindowTokens(options?.windowTokens)
  const usage = options?.usage
  if (usage != null) {
    const usedTokens = totalUsageTokens(usage)
    if (usedTokens > 0) {
      return {
        source: 'usage',
        usedTokens,
        windowTokens,
        usedPercent: clampPercent(usedTokens, windowTokens),
      }
    }
  }

  const chars = estimateOutboundChars(messages)
  const usedTokens = Math.ceil(chars / CHARS_PER_TOKEN_ESTIMATE)
  return {
    source: 'chars',
    usedTokens,
    windowTokens,
    usedPercent: clampPercent(usedTokens, windowTokens),
  }
}

/** 格式化为 REPL 一行，如 `ctx ~42%` */
export function formatContextUsage(estimate: ContextUsageEstimate): string {
  return `ctx ~${estimate.usedPercent}%`
}

function clampPercent(used: number, window: number): number {
  if (window <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / window) * 100)))
}
