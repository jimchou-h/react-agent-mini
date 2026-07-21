import { z } from 'zod'
import type { Tool, ToolResult } from '../../Tool.js'

/** MCP list_tools 条目的最小形状（便于测试注入） */
export type McpToolInfo = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
}

export type McpCallTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>

/** 公开工具名：`mcp__<server>__<tool>`，避免与 builtin 冲突 */
export function mcpPublicToolName(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`
}

/**
 * 将 MCP tool 适配为内部 Tool
 *
 * Zod 使用宽松 record（服务端仍会校验）；出站 schema 优先用 MCP inputSchema。
 */
export function adaptMcpTool(
  serverId: string,
  info: McpToolInfo,
  callTool: McpCallTool,
): Tool {
  const publicName = mcpPublicToolName(serverId, info.name)
  const readOnly = info.annotations?.readOnlyHint === true
  const inputSchema = z.record(z.unknown())

  return {
    name: publicName,
    description: info.description?.trim() || `MCP tool ${info.name} (${serverId})`,
    inputSchema,
    inputJsonSchema:
      info.inputSchema && typeof info.inputSchema === 'object'
        ? info.inputSchema
        : { type: 'object', properties: {} },

    async call(args): Promise<ToolResult> {
      try {
        const result = await callTool(info.name, args as Record<string, unknown>)
        return { data: formatMcpResult(result) }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new Error(`MCP 调用失败 (${publicName}): ${msg}`)
      }
    },

    isReadOnly() {
      return readOnly
    },

    isConcurrencySafe() {
      return readOnly
    },

    isEnabled() {
      return true
    },
  }
}

function formatMcpResult(result: unknown): string {
  if (result == null) return ''
  if (typeof result === 'string') return result

  if (typeof result === 'object' && result !== null && 'content' in result) {
    const content = (result as { content?: unknown }).content
    if (Array.isArray(content)) {
      return content
        .map(block => {
          if (
            block &&
            typeof block === 'object' &&
            'type' in block &&
            (block as { type: string }).type === 'text' &&
            'text' in block
          ) {
            return String((block as { text: unknown }).text)
          }
          return JSON.stringify(block)
        })
        .join('\n')
    }
  }

  return typeof result === 'object'
    ? JSON.stringify(result, null, 2)
    : String(result)
}
