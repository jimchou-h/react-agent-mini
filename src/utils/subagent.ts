/**
 * 子代理上下文派生与摘要（对齐 CC createSubagentContext 精简版）
 */

import type { ToolUseContext, Tools } from '../Tool.js'
import type { AssistantMessage, Message } from '../types/message.js'

export const AGENT_TOOL_NAME = 'Agent'

/** 允许的最大子代理 depth（父为 0 时可 spawn depth=1） */
export const DEFAULT_MAX_AGENT_DEPTH = 1

/** 回传父会话的摘要字符预算 */
export const DEFAULT_AGENT_SUMMARY_BUDGET = 32 * 1024

/**
 * 子会话工具表：去掉 Agent，并可按 tool_names 白名单过滤。
 */
export function toolsForSubagent(
  parentTools: Tools,
  toolNames?: readonly string[],
): Tools {
  let tools = parentTools.filter(t => t.name !== AGENT_TOOL_NAME)
  if (toolNames && toolNames.length > 0) {
    const allow = new Set(toolNames)
    tools = tools.filter(t => allow.has(t.name))
  }
  return tools
}

/**
 * 从父 context 派生子代理 context（独立 abort、depth+1）。
 */
export function createSubagentContext(
  parent: ToolUseContext,
  overrides?: { tools?: Tools },
): ToolUseContext {
  const parentAbort = parent.abortController
  const childAbort = new AbortController()
  if (parentAbort) {
    if (parentAbort.signal.aborted) {
      childAbort.abort(parentAbort.signal.reason)
    } else {
      parentAbort.signal.addEventListener(
        'abort',
        () => {
          childAbort.abort(parentAbort.signal.reason)
        },
        { once: true },
      )
    }
  }

  return {
    ...parent,
    tools: overrides?.tools ?? toolsForSubagent(parent.tools),
    depth: (parent.depth ?? 0) + 1,
    abortController: childAbort,
  }
}

/**
 * 从 assistant 消息提取纯文本（忽略 tool_use）。
 */
export function assistantTextContent(message: AssistantMessage): string {
  return message.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
}

/**
 * 取消息列表中最后一条 assistant 的 text；超长则保留尾部。
 */
export function summarizeAgentResult(
  messages: readonly Message[],
  budget: number = DEFAULT_AGENT_SUMMARY_BUDGET,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.type !== 'assistant') continue
    const text = assistantTextContent(m)
    if (!text) continue
    if (text.length <= budget) return text
    return text.slice(text.length - budget)
  }
  return ''
}

/**
 * 从 drain 到的 assistant 流取最后一条有 text 的摘要。
 */
export function summarizeFromAssistants(
  assistants: readonly AssistantMessage[],
  budget: number = DEFAULT_AGENT_SUMMARY_BUDGET,
): string {
  return summarizeAgentResult(
    assistants.map(a => a),
    budget,
  )
}
