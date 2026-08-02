/**
 * Agent 工具：同步嵌套 query 子代理（对齐 CC AgentTool 精简版）
 */

import { z } from 'zod'
import type { Tool, ToolUseContext } from '../Tool.js'
import type { AssistantMessage } from '../types/message.js'
import type { Terminal } from '../query/types.js'
import { query } from '../query.js'
import { productionDeps } from '../query/deps.js'
import { createUserMessage } from '../utils/messages.js'
import {
  AGENT_TOOL_NAME,
  DEFAULT_MAX_AGENT_DEPTH,
  createSubagentContext,
  summarizeFromAssistants,
  toolsForSubagent,
} from '../utils/subagent.js'
import { trace } from '../utils/trace.js'

const agentInputSchema = z.object({
  description: z
    .string()
    .min(1)
    .describe('A short (3-5 word) description of the task'),
  prompt: z.string().min(1).describe('The task for the agent to perform'),
  tool_names: z
    .array(z.string())
    .optional()
    .describe('Optional allowlist of tool names for the subagent'),
})

async function drainNestedQuery(
  params: Parameters<typeof query>[0],
): Promise<{
  terminal: Terminal
  assistants: AssistantMessage[]
}> {
  const assistants: AssistantMessage[] = []
  const gen = query(params)
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      return { terminal: value, assistants }
    }
    if (value.type === 'assistant') {
      assistants.push(value)
    }
  }
}

/**
 * 同步子代理：嵌套 query，摘要回父 tool_result。
 */
export const AgentTool: Tool<typeof agentInputSchema> = {
  name: AGENT_TOOL_NAME,
  description:
    'Run a synchronous subagent with an isolated message list; returns a text summary',
  inputSchema: agentInputSchema,

  async call(args, context: ToolUseContext) {
    const parentDepth = context.depth ?? 0
    if (parentDepth >= DEFAULT_MAX_AGENT_DEPTH) {
      return {
        data: `Agent nesting depth exceeded (max ${DEFAULT_MAX_AGENT_DEPTH})`,
        isError: true,
      }
    }

    const childTools = toolsForSubagent(context.tools, args.tool_names)
    const childCtx = createSubagentContext(context, { tools: childTools })
    const childMessages = [createUserMessage(args.prompt)]
    const deps = { ...productionDeps(), ...context.queryDeps }

    trace('agent.start', {
      description: args.description,
      depth: childCtx.depth ?? 1,
    })

    let terminal: Terminal
    let assistants: AssistantMessage[]
    try {
      ;({ terminal, assistants } = await drainNestedQuery({
        messages: childMessages,
        tools: childTools,
        toolUseContext: childCtx,
        depth: childCtx.depth ?? 1,
        deps,
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      trace('agent.end', {
        description: args.description,
        ok: false,
        error: msg,
      })
      return { data: `Agent failed: ${msg}`, isError: true }
    }

    if (terminal.reason === 'aborted') {
      trace('agent.end', {
        description: args.description,
        ok: false,
        reason: 'aborted',
      })
      return { data: 'Agent aborted', isError: true }
    }

    const summary = summarizeFromAssistants(assistants)
    if (!summary) {
      trace('agent.end', {
        description: args.description,
        ok: false,
        reason: terminal.reason,
      })
      return {
        data: `Agent finished without text (${terminal.reason})`,
        isError: true,
      }
    }

    trace('agent.end', {
      description: args.description,
      ok: true,
      reason: terminal.reason,
    })
    return {
      data: `[Agent: ${args.description}]\n${summary}`,
    }
  },

  isReadOnly() {
    return false
  },

  isConcurrencySafe() {
    return false
  },

  isEnabled() {
    return true
  },
}
