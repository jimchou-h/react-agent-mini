#!/usr/bin/env node
/**
 * PostToolUse 示例：把工具结果摘要打到 stderr（不改变 tool_result）。
 */
const chunks = []
for await (const c of process.stdin) chunks.push(c)
const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
const preview = String(payload.tool_result ?? '').slice(0, 80)
console.error(
  `[hooks-demo] post ${payload.tool_name} error=${Boolean(payload.tool_is_error)} ${preview}`,
)
process.exit(0)
