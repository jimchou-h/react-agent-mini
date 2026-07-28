/**
 * TRACE=1 时往 stderr 打结构化调试行；否则直接 return（零开销）。
 * 勿往 detail 里塞密钥或完整文件正文。
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
