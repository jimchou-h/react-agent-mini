import type { ContentBlock, Message } from '../types/message.js'

/** Transcript row for Ink Messages (CC-aligned shape, mini host). */
export type TranscriptItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string; streaming?: boolean }
  | {
      kind: 'tool'
      id: string
      toolName: string
      summary: string
      status: 'running' | 'done' | 'error'
    }
  | { kind: 'system'; id: string; text: string }

export type PermissionRequest = {
  id: string
  toolName: string
  description: string
  resolve: (answer: string) => void
}

export type HostBridgeSnapshot = {
  items: readonly TranscriptItem[]
  streamingText: string
  turnInProgress: boolean
  permission: PermissionRequest | null
  statusLine: string
  ctxPercent: string | null
}

export type HostBridgeListener = (snap: HostBridgeSnapshot) => void

export function contentText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(b => b.type === 'text')
    .map(b => (b.type === 'text' ? b.text : ''))
    .join('')
}

export function summarizeToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const rec = input as Record<string, unknown>
  for (const key of ['file_path', 'path', 'command', 'pattern', 'query', 'url']) {
    if (typeof rec[key] === 'string') return String(rec[key])
  }
  try {
    return JSON.stringify(input).slice(0, 120)
  } catch {
    return ''
  }
}

let idSeq = 0
export function nextHostId(prefix: string): string {
  idSeq += 1
  return `${prefix}-${idSeq}`
}

/** Test helper */
export function resetHostIdSeq(): void {
  idSeq = 0
}

export function messageToItems(message: Message): TranscriptItem[] {
  if (message.type === 'user') {
    const texts: TranscriptItem[] = []
    for (const block of message.content) {
      if (block.type === 'text' && block.text.trim()) {
        texts.push({
          kind: 'user',
          id: nextHostId('user'),
          text: block.text,
        })
      }
      if (block.type === 'tool_result') {
        texts.push({
          kind: 'tool',
          id: block.tool_use_id || nextHostId('tool'),
          toolName: 'result',
          summary: block.content.slice(0, 200),
          status: block.is_error ? 'error' : 'done',
        })
      }
    }
    return texts
  }

  const items: TranscriptItem[] = []
  let assistantText = ''
  for (const block of message.content) {
    if (block.type === 'text') assistantText += block.text
    if (block.type === 'tool_use') {
      if (assistantText.trim()) {
        items.push({
          kind: 'assistant',
          id: nextHostId('asst'),
          text: assistantText,
        })
        assistantText = ''
      }
      items.push({
        kind: 'tool',
        id: block.id,
        toolName: block.name,
        summary: summarizeToolInput(block.input),
        status: 'running',
      })
    }
  }
  if (assistantText.trim()) {
    items.push({
      kind: 'assistant',
      id: nextHostId('asst'),
      text: assistantText,
    })
  }
  return items
}
