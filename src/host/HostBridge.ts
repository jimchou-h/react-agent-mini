/**
 * Host Bridge — sole seam between QueryEngine and Ink UI (`src/ui`).
 */

import type { QueryEngine } from '../QueryEngine.js'
import {
  estimateContextUsage,
  formatContextUsage,
} from '../services/compact/contextUsage.js'
import type { AskFn } from '../permissions/canUseTool.js'
import {
  type HostBridgeListener,
  type HostBridgeSnapshot,
  type PermissionRequest,
  type TranscriptItem,
  messageToItems,
  nextHostId,
} from './types.js'
import { isSkippableReplLine } from '../entrypoints/repl.js'

export type HostBridgeOptions = {
  engine: QueryEngine
  /** Optional: handle slash / system notices via callback (UI shows system rows) */
  onSystemNotice?: (text: string) => void
}

export class HostBridge {
  readonly #engine: QueryEngine
  readonly #listeners = new Set<HostBridgeListener>()
  #items: TranscriptItem[] = []
  #streamingText = ''
  #turnInProgress = false
  #permission: PermissionRequest | null = null
  #statusLine = ''
  #ctxPercent: string | null = null
  #askWaiters: Array<(answer: string) => void> = []

  constructor(options: HostBridgeOptions) {
    this.#engine = options.engine
  }

  get engine(): QueryEngine {
    return this.#engine
  }

  subscribe(listener: HostBridgeListener): () => void {
    this.#listeners.add(listener)
    listener(this.snapshot())
    return () => {
      this.#listeners.delete(listener)
    }
  }

  snapshot(): HostBridgeSnapshot {
    return {
      items: this.#items,
      streamingText: this.#streamingText,
      turnInProgress: this.#turnInProgress,
      permission: this.#permission,
      statusLine: this.#statusLine,
      ctxPercent: this.#ctxPercent,
    }
  }

  /** AskFn for createReplCanUseTool — queues PermissionRequest for Ink. */
  createAskFn(): AskFn {
    return async (prompt: string) => {
      const toolNameMatch = /Allow\s+(\S+)/i.exec(prompt)
      const toolName = toolNameMatch?.[1] ?? 'tool'
      return await new Promise<string>(resolve => {
        const req: PermissionRequest = {
          id: nextHostId('perm'),
          toolName,
          description: prompt,
          resolve: (answer: string) => {
            this.#permission = null
            this.#emit()
            resolve(answer)
          },
        }
        this.#permission = req
        this.#emit()
      })
    }
  }

  answerPermission(answer: string): void {
    this.#permission?.resolve(answer)
  }

  clearTranscript(): void {
    this.#items = []
    this.#streamingText = ''
    this.#ctxPercent = null
    this.#emit()
  }

  pushSystem(text: string): void {
    this.#items = [
      ...this.#items,
      { kind: 'system', id: nextHostId('sys'), text },
    ]
    this.#emit()
  }

  /**
   * Submit a normal user line (not slash). Empty lines are skipped.
   * @returns false if skipped / already in turn
   */
  async submitUserText(text: string): Promise<boolean> {
    if (isSkippableReplLine(text)) return false
    if (this.#turnInProgress) return false
    if (this.#permission) return false

    const trimmed = text.trim()
    this.#items = [
      ...this.#items,
      { kind: 'user', id: nextHostId('user'), text: trimmed },
    ]
    this.#streamingText = ''
    this.#turnInProgress = true
    this.#statusLine = 'running…'
    this.#emit()

    try {
      for await (const yield_ of this.#engine.runTurn(trimmed)) {
        if (yield_.type === 'text_delta') {
          this.#streamingText += yield_.text
          this.#emit()
          continue
        }
        if (yield_.type === 'assistant' || yield_.type === 'user') {
          const hadStream = this.#streamingText.trim().length > 0
          if (hadStream) {
            this.#items = [
              ...this.#items,
              {
                kind: 'assistant',
                id: nextHostId('asst'),
                text: this.#streamingText,
              },
            ]
            this.#streamingText = ''
          }
          if (yield_.type === 'user') {
            const extras = messageToItems(yield_).filter(i => i.kind !== 'user')
            this.#items = [...this.#items, ...extras]
          } else if (!hadStream) {
            this.#items = [...this.#items, ...messageToItems(yield_)]
          } else {
            // tools only from assistant message when text already streamed
            this.#items = [
              ...this.#items,
              ...messageToItems(yield_).filter(i => i.kind === 'tool'),
            ]
          }
          this.#emit()
        }
      }
    } finally {
      if (this.#streamingText.trim()) {
        this.#items = [
          ...this.#items,
          {
            kind: 'assistant',
            id: nextHostId('asst'),
            text: this.#streamingText,
          },
        ]
        this.#streamingText = ''
      }
      this.#turnInProgress = false
      this.#statusLine = ''
      const estimate = estimateContextUsage(this.#engine.messages, {
        usage: this.#engine.lastUsage ?? null,
      })
      this.#ctxPercent = formatContextUsage(estimate)
      const feedback = this.#engine.takeCompactFeedback()
      if (feedback) this.pushSystem(feedback)
      this.#emit()
    }

    return true
  }

  abortTurn(): boolean {
    return this.#engine.abortCurrentTurn('interrupt')
  }

  #emit(): void {
    const snap = this.snapshot()
    for (const listener of this.#listeners) listener(snap)
  }
}
