/**
 * Context Budget：调用模型前裁剪「出站」消息副本
 *
 * 管道（对齐 Claude Code 精简版）：
 * 1. 单条 tool_result 硬截断（budget）
 * 2. 超阈值 → microcompact：旧的可压缩 tool_result 换成短占位
 * 3. 仍超 → 按 maxMessages 保尾（不拆开 tool_use/tool_result 配对）
 *
 * 只改发给模型的副本，默认不写回会话内存（出站-only）。
 */

import type {
  Message,
  ToolResultBlock,
  ToolUseBlock,
} from '../../types/message.js'
import { trace } from '../../utils/trace.js'

/** 追加在被截断 tool_result 末尾的提示 */
export const TRUNCATION_NOTE = '\n…[tool_result 已截断（compact）]'

/** microcompact 占位正文 — 对齐 claude-code */
export const MICROCOMPACT_NOTE = '[Old tool result content cleared]'

/** 可参与 microcompact 的内置工具 */
export const COMPACTABLE_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Grep',
  'Glob',
])

/** 是否允许把该工具的旧 tool_result 换成 microcompact 占位（内置名单 + 全部 mcp__*） */
export function isCompactableToolName(name: string): boolean {
  return COMPACTABLE_TOOLS.has(name) || name.startsWith('mcp__')
}

/** 默认出站字符阈值：低于此值不做 micro / 保尾 */
export const DEFAULT_MAX_OUTBOUND_CHARS = 80_000

/** 默认保留最近若干条完整 tool_result（更早的才可被占位） */
export const DEFAULT_MICRO_KEEP_RECENT = 4

/** tool_result 超过此长度才参与 microcompact 占位 */
export const DEFAULT_MICRO_MIN_CHARS = 500

/** compact 策略配置；缺省值见模块内 DEFAULT_* 常量 */
export type CompactOptions = {
  /** 是否启用；缺省读环境变量 `COMPACT`（`0` 关闭，其余开启） */
  enabled?: boolean
  /** 单条 tool_result.content 字符上限，超出则截断 */
  maxToolResultChars?: number
  /** 出站消息条数上限；仅当（重估后）仍超阈值时保尾丢轮 */
  maxMessages?: number
  /**
   * 出站字符估算阈值；超过才跑 microcompact，micro 后再估仍超才保尾。
   * 缺省读 `COMPACT_THRESHOLD_CHARS`，再回落 `DEFAULT_MAX_OUTBOUND_CHARS`。
   */
  maxOutboundChars?: number
  /** 保留最近 N 条完整 tool_result；缺省 `DEFAULT_MICRO_KEEP_RECENT` */
  microKeepRecent?: number
  /** 仅当 tool_result 长度 > 此值才可被占位；缺省 `DEFAULT_MICRO_MIN_CHARS` */
  microMinChars?: number
}

const DEFAULT_MAX_TOOL_RESULT_CHARS = 4000
const DEFAULT_MAX_MESSAGES = 40

/** 对齐 claude-code deps.microcompact 的函数形状 */
export type MicrocompactFn = (
  messages: Message[],
  options?: CompactOptions,
) => Message[] | Promise<Message[]>

/**
 * 出站裁剪编排（测试 / 兼容入口）
 *
 * 管道对齐 claude-code query 前半段的确定性层：
 * `applyToolResultBudget` → `microcompact` →（重估后）`retainTail`
 * 生产路径由 `query.ts` 逐步调用；本函数供单测一次跑完。
 */
export function compactMessages(
  messages: Message[],
  options?: CompactOptions,
  microcompact: MicrocompactFn = microcompactMessages,
): Message[] {
  if (!isCompactEnabled(options)) return messages

  const afterBudget = applyToolResultBudget(messages, options)
  const afterMicro = syncMicrocompact(microcompact, afterBudget, options)
  return applyRetainTailIfNeeded(afterMicro, options)
}

/**
 * ① 单条 tool_result 硬截断 — 对齐 claude-code `applyToolResultBudget`
 *
 * 无论是否超阈值都会执行（防单条炸弹）。出站-only。
 */
export function applyToolResultBudget(
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  if (!isCompactEnabled(options)) return messages

  const maxToolResultChars =
    options?.maxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS

  let truncatedBlocks = 0
  const out = messages.map(message => {
    if (message.type !== 'user') return message

    let changed = false
    const content = message.content.map(block => {
      if (
        block.type === 'tool_result' &&
        block.content.length > maxToolResultChars
      ) {
        changed = true
        truncatedBlocks++
        return truncateToolResult(block, maxToolResultChars)
      }
      return block
    })

    return changed ? { ...message, content } : message
  })

  if (truncatedBlocks === 0) return messages

  trace('compact.run', {
    stage: 'budget',
    before: messages.length,
    after: out.length,
    truncatedBlocks,
    strategy: 'truncate',
  })
  return out
}

/**
 * ② microcompact — 对齐 claude-code `deps.microcompact`
 *
 * 低于阈值：原样返回。超过阈值：较早超长 tool_result → 短占位，保留最近窗口。
 */
export function microcompactMessages(
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  if (!isCompactEnabled(options)) return messages

  const maxOutboundChars = resolveMaxOutboundChars(options)
  const estimated = estimateOutboundChars(messages)
  if (estimated <= maxOutboundChars) return messages

  const microKeepRecent =
    options?.microKeepRecent ?? DEFAULT_MICRO_KEEP_RECENT
  const microMinChars = options?.microMinChars ?? DEFAULT_MICRO_MIN_CHARS
  const { messages: out, replaced } = applyMicrocompact(
    messages,
    microKeepRecent,
    microMinChars,
  )

  if (replaced === 0) return messages

  trace('compact.micro', { replaced })
  trace('compact.run', {
    stage: 'micro',
    before: messages.length,
    after: out.length,
    estimated,
    overThreshold: true,
    strategy: 'micro',
  })
  return out
}

/**
 * ③ 保尾 — 作为 autocompact 的确定性替身（无 LLM）
 *
 * **重估**出站字符；仍超阈值且条数超限时才丢最早轮次。
 * micro 已把规模压回去时本步 no-op（对齐 claude-code「前面够了后面不加重」）。
 */
export function applyRetainTailIfNeeded(
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  if (!isCompactEnabled(options)) return messages

  const maxOutboundChars = resolveMaxOutboundChars(options)
  const maxMessages = options?.maxMessages ?? DEFAULT_MAX_MESSAGES
  const estimated = estimateOutboundChars(messages)

  if (estimated <= maxOutboundChars) return messages

  const out = retainTail(messages, maxMessages)
  const droppedMessages = messages.length - out.length
  if (droppedMessages === 0) return messages

  trace('compact.run', {
    stage: 'retain',
    before: messages.length,
    after: out.length,
    droppedMessages,
    estimated,
    overThreshold: true,
    strategy: 'retain',
  })
  return out
}

function isCompactEnabled(options?: CompactOptions): boolean {
  return options?.enabled ?? process.env.COMPACT !== '0'
}

function syncMicrocompact(
  fn: MicrocompactFn,
  messages: Message[],
  options?: CompactOptions,
): Message[] {
  const result = fn(messages, options)
  if (result instanceof Promise) {
    throw new Error(
      'compactMessages 同步编排不支持 async microcompact；请在 query 管道中 await deps.microcompact',
    )
  }
  return result
}

/** 解析出站字符阈值：options → env → 默认 */
export function resolveMaxOutboundChars(options?: CompactOptions): number {
  if (options?.maxOutboundChars != null) return options.maxOutboundChars
  const raw = process.env.COMPACT_THRESHOLD_CHARS
  if (raw != null && /^\d+$/.test(raw)) return Number(raw)
  return DEFAULT_MAX_OUTBOUND_CHARS
}

/**
 * 出站消息字符近似估算（text + tool_result + tool_use 名称/入参 JSON）
 */
export function estimateOutboundChars(messages: Message[]): number {
  let total = 0
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'text') {
        total += block.text.length
      } else if (block.type === 'tool_result') {
        total += block.content.length
      } else if (block.type === 'tool_use') {
        total += block.name.length
        try {
          total += JSON.stringify(block.input).length
        } catch {
          total += 0
        }
      }
    }
  }
  return total
}

/**
 * 将较早的超长 tool_result 替换为占位；保留最近 keepRecent 条全文。
 */
function applyMicrocompact(
  messages: Message[],
  keepRecent: number,
  minChars: number,
): { messages: Message[]; replaced: number } {
  const refs: { msgIndex: number; blockIndex: number }[] = []
  for (let mi = 0; mi < messages.length; mi++) {
    const message = messages[mi]
    if (message.type !== 'user') continue
    for (let bi = 0; bi < message.content.length; bi++) {
      const block = message.content[bi]
      if (block.type === 'tool_result') {
        refs.push({ msgIndex: mi, blockIndex: bi })
      }
    }
  }

  if (refs.length === 0) return { messages, replaced: 0 }

  const toolMeta = collectToolUseMeta(messages)
  const replaceable = new Set<string>()
  const cutoff = Math.max(0, refs.length - keepRecent)
  for (let i = 0; i < cutoff; i++) {
    const ref = refs[i]
    const message = messages[ref.msgIndex]
    if (message.type !== 'user') continue
    const block = message.content[ref.blockIndex]
    if (block.type !== 'tool_result' || block.content.length <= minChars) {
      continue
    }
    const meta = toolMeta.get(block.tool_use_id)
    if (!meta || !isCompactableToolName(meta.name)) {
      continue
    }
    replaceable.add(`${ref.msgIndex}:${ref.blockIndex}`)
  }

  if (replaceable.size === 0) return { messages, replaced: 0 }

  let replaced = 0
  const out = messages.map((message, msgIndex) => {
    if (message.type !== 'user') return message

    let changed = false
    const content = message.content.map((block, blockIndex) => {
      if (block.type !== 'tool_result') return block
      if (!replaceable.has(`${msgIndex}:${blockIndex}`)) return block

      changed = true
      replaced++
      const meta = toolMeta.get(block.tool_use_id)
      return {
        ...block,
        content: buildMicroPlaceholder(meta),
      }
    })

    return changed ? { ...message, content } : message
  })

  return { messages: out, replaced }
}

function collectToolUseMeta(
  messages: Message[],
): Map<string, { name: string; path?: string }> {
  const map = new Map<string, { name: string; path?: string }>()
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'tool_use') {
        map.set(block.id, {
          name: block.name,
          path: extractPathHint(block),
        })
      }
    }
  }
  return map
}

function extractPathHint(block: ToolUseBlock): string | undefined {
  const input = block.input
  if (input && typeof input === 'object') {
    const record = input as { file_path?: unknown; path?: unknown }
    const filePath = record.file_path
    if (typeof filePath === 'string' && filePath.length > 0) return filePath
    const path = record.path
    if (typeof path === 'string' && path.length > 0) return path
  }
  return undefined
}

function buildMicroPlaceholder(meta?: {
  name: string
  path?: string
}): string {
  const parts = [MICROCOMPACT_NOTE]
  if (meta?.name) parts.push(`tool=${meta.name}`)
  if (meta?.path) parts.push(meta.path)
  return parts.join(' ')
}

function isUserTextMessage(message: Message): boolean {
  return (
    message.type === 'user' && message.content.every(b => b.type === 'text')
  )
}

function retainTail(messages: Message[], maxMessages: number): Message[] {
  if (messages.length <= maxMessages) return messages

  let start = messages.length - maxMessages
  // 切点必须落在「纯文本 user」上，否则会拆开 assistant.tool_use 与后续 tool_result
  while (start < messages.length && !isUserTextMessage(messages[start])) {
    start++
  }
  if (start >= messages.length) return messages

  return messages.slice(start)
}

function truncateToolResult(
  block: ToolResultBlock,
  maxChars: number,
): ToolResultBlock {
  return {
    ...block,
    content: block.content.slice(0, maxChars) + TRUNCATION_NOTE,
  }
}
