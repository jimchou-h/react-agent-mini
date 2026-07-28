/**
 * MCP Tool → 内部 Tool 适配
 *
 * server 暴露的工具名可能和内置冲突，所以对外一律改成：
 * `mcp__<server>__<tool>`（`.` / 空格会先变成 `_`）。
 * call 时再转回 server 原始工具名去 `tools/call`。
 */

import { z } from 'zod'
import type { Tool, ToolResult } from '../../Tool.js'

/** MCP list_tools 条目的最小形状（便于测试注入） */
export type McpToolInfo = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
  annotations?: { readOnlyHint?: boolean }
}

/** 用 MCP 原始 tool 名发起 call（公开名带前缀，call 时仍用服务端原始名） */
export type McpCallTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>

/** 公开工具名片段规范化：`.` / 空白 → `_` */
export function normalizeNameForMCP(name: string): string {
  return name.replace(/[.\s]/g, '_')
}

/** 会话内注册 / 模型可见的工具名；callTool 仍传 MCP 原始 name */
export function mcpPublicToolName(serverId: string, toolName: string): string {
  return `mcp__${normalizeNameForMCP(serverId)}__${normalizeNameForMCP(toolName)}`
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
        const data = formatMcpResult(result)
        const isError = mcpResultIsError(result)
        return isError ? { data, isError: true } : { data }
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

function mcpResultIsError(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    'isError' in result &&
    (result as { isError?: unknown }).isError === true
  )
}

/** 将 MCP tools/call 结果格式化为模型可读文本 */
export function formatMcpResult(result: unknown): string {
  if (result == null) return ''
  if (typeof result === 'string') return result

  if (typeof result === 'object' && result !== null && 'content' in result) {
    const content = (result as { content?: unknown }).content
    if (Array.isArray(content)) {
      return content.map(formatContentBlock).join('\n')
    }
  }

  return typeof result === 'object'
    ? JSON.stringify(result, null, 2)
    : String(result)
}

function formatContentBlock(block: unknown): string {
  if (!block || typeof block !== 'object' || !('type' in block)) {
    return JSON.stringify(block)
  }

  const typed = block as { type: string; text?: unknown; mimeType?: unknown }
  if (typed.type === 'text' && 'text' in typed) {
    return String(typed.text)
  }
  if (typed.type === 'image') {
    const mime =
      typeof typed.mimeType === 'string' && typed.mimeType
        ? typed.mimeType
        : 'unknown'
    return `[图片: ${mime}，内容已省略]`
  }
  return JSON.stringify(block)
}
