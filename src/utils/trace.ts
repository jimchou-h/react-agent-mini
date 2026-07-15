/**
 * TRACE=1 时输出结构化调试日志到 stderr；否则零开销。
 */
export function isTraceEnabled(): boolean {
  return process.env.TRACE === '1'
}

/**
 * @param stage - 固定 stage 名，如 `cli.start`
 * @param detail - 可选摘要字段（勿放密钥/完整正文）
 */
export function trace(
  stage: string,
  detail?: Record<string, unknown>,
): void {
  if (!isTraceEnabled()) return

  const parts = ['[trace]', stage]
  if (detail) {
    for (const [key, value] of Object.entries(detail)) {
      parts.push(`${key}=${String(value)}`)
    }
  }
  console.error(parts.join(' '))
}
