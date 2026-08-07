/**
 * MCP 用户可见失败文案（prompt / resource 统一前缀）
 */

export type McpFailureKind = 'prompt' | 'resource'

/** 稳定可读错误；detail 为空时仍给出非空说明 */
export function formatMcpFailure(
  kind: McpFailureKind,
  detail: string,
): string {
  const trimmed = detail.trim()
  const body = trimmed.length > 0 ? trimmed : '未知错误'
  return kind === 'prompt'
    ? `MCP prompt 失败: ${body}`
    : `MCP resource 失败: ${body}`
}
