#!/usr/bin/env node
/**
 * Stop 示例：顶层 query completed 时触发。
 *
 * 默认 exit 0（只打日志）。
 * STOP_DEMO=block   → exit 2，注入 feedback 再进一轮
 * STOP_DEMO=prevent → stdout `{ "continue": false }`，即使可 blocking 也直接结束
 */
const chunks = []
for await (const c of process.stdin) chunks.push(c)
const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
const mode = process.env.STOP_DEMO || ''

console.error(
  `[hooks-demo] stop active=${Boolean(payload.stop_hook_active)} mode=${mode || 'observe'}`,
)

if (mode === 'prevent') {
  console.log(JSON.stringify({ continue: false, stopReason: 'demo prevent' }))
  process.exit(0)
}

if (mode === 'block') {
  console.error('examples/hooks: Stop demo requests another turn')
  process.exit(2)
}

process.exit(0)
