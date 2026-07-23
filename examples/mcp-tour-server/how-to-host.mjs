/**
 * 最小 Host 用法：演示「产品里该怎么调」Tools / Resources / Prompts。
 * 比 smoke 更贴近真实接入：读材料 → 取开场白 → 再调工具。
 *
 *   node examples/mcp-tour-server/how-to-host.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')

const transport = new StdioClientTransport({
  command: 'node',
  args: [join(here, 'server.js')],
  cwd: root,
  stderr: 'pipe',
})

const client = new Client({ name: 'how-to-host', version: '0.0.0' })
await client.connect(transport)

// —— 真实 Host 会做的三步 ——
// 1) 用户在 UI 勾选「差旅手册」→ 你 readResource，塞进本轮上下文
const handbook = await client.readResource({ uri: 'docs://handbook' })
const handbookText = handbook.contents?.[0]?.text ?? ''

// 2) 用户点斜杠命令 /plan_trip → 你 getPrompt，把返回的 messages 当用户开场
const prompt = await client.getPrompt({
  name: 'plan_trip',
  arguments: { city: '巴黎', days: '3' },
})
const opening =
  prompt.messages?.[0]?.content?.text ??
  JSON.stringify(prompt.messages?.[0]?.content)

// 3) 模型决定算预算 → 你 callTool（通常先问用户 y/N）
const calc = await client.callTool({
  name: 'add',
  arguments: { a: 1200, b: 800 },
})
const calcText = calc.content?.[0]?.text ?? JSON.stringify(calc.content)

// 组装「即将发给模型」的一轮消息（示意，未真调 LLM）
const roundForModel = {
  systemExtras: [
    '以下材料来自 MCP Resource，请严格遵守：',
    handbookText.trim(),
  ].join('\n\n'),
  userMessage: opening,
  // 若模型随后 tool_use add，Host 执行后把结果回注：
  toolResultExample: calcText,
}

console.log('=== 作为 Host，你会这样用 ===\n')
console.log('① Resource 挂进上下文（前 2 行）：')
console.log(roundForModel.systemExtras.split('\n').slice(0, 4).join('\n'), '\n…\n')
console.log('② Prompt 变成用户开场：')
console.log(roundForModel.userMessage, '\n')
console.log('③ Tool 结果回注（示意模型调了 add）：')
console.log(roundForModel.toolResultExample)
console.log('\n接下来：把 systemExtras + userMessage 发给 LLM；')
console.log('若返回 tool_use，再 callTool，把 tool_result 追加进 messages 继续。')

await client.close()
await transport.close()
