/**
 * 演示 Host→Server：Tools / Resources / Prompts。
 * 用法（仓库根目录）：node examples/mcp-tour-server/smoke.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const serverPath = join(here, 'server.js')

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath],
  cwd: root,
  stderr: 'pipe',
})

const client = new Client({ name: 'mcp-tour-smoke', version: '0.0.0' })
await client.connect(transport)

console.log('\n=== 1) Tools：做事 ===')
const tools = await client.listTools()
console.log(
  'list_tools →',
  tools.tools.map(t => t.name).join(', '),
)
const addResult = await client.callTool({
  name: 'add',
  arguments: { a: 17, b: 25 },
})
console.log('tools/call add(17,25) →', JSON.stringify(addResult.content))

console.log('\n=== 2) Resources：给材料 ===')
const resources = await client.listResources()
console.log(
  'list_resources →',
  resources.resources.map(r => `${r.name} (${r.uri})`).join(', '),
)
const handbook = await client.readResource({ uri: 'docs://handbook' })
const text = handbook.contents?.[0]?.text ?? ''
console.log('resources/read →\n' + text.trim().split('\n').slice(0, 3).join('\n') + '\n…')

console.log('\n=== 3) Prompts：给开场白 ===')
const prompts = await client.listPrompts()
console.log(
  'list_prompts →',
  prompts.prompts.map(p => p.name).join(', '),
)
const prompt = await client.getPrompt({
  name: 'plan_trip',
  arguments: { city: '巴黎', days: '3' },
})
const msg = prompt.messages?.[0]?.content
const body = typeof msg === 'object' && msg && 'text' in msg ? msg.text : msg
console.log('prompts/get plan_trip →\n' + body)

console.log('\n=== 4) Sampling / Roots / Elicitation（协议示意，本 smoke 不实跑） ===')
console.log(`
Sampling  方向反过来：Server → Host「借你的模型想一下」
  sampling/createMessage { messages: [...], maxTokens: 256 }

Roots     Host → Server「你只准动这些目录」
  roots/list → [{ uri: "file:///path/to/project" }]

Elicitation  Server → Host「还缺字段，弹表单」
  elicitation/create { message: "选餐型", requestedSchema: {...} }
`)

await client.close()
await transport.close()
console.log('done.')
