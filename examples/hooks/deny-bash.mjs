#!/usr/bin/env node
/**
 * PreToolUse 示例：拦截 Bash。
 * exit 2 → Host deny，不执行工具。
 */
const chunks = []
for await (const c of process.stdin) chunks.push(c)
const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
if (payload.tool_name === 'Bash') {
  console.error('examples/hooks: Bash blocked by PreToolUse demo')
  process.exit(2)
}
process.exit(0)
