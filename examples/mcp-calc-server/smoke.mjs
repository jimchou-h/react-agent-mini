/**
 * 快速验证 examples/mcp-calc-server 能否被 list/call。
 * 用法（在仓库根目录）：node examples/mcp-calc-server/smoke.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const serverPath = join(here, 'server.js')

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath],
  cwd: join(here, '../..'),
  stderr: 'pipe',
})

const client = new Client({ name: 'smoke', version: '0.0.0' })
await client.connect(transport)

const listed = await client.listTools()
console.log(
  'tools:',
  listed.tools.map(t => t.name).join(', '),
)

const result = await client.callTool({
  name: 'add',
  arguments: { a: 17, b: 25 },
})
console.log('add(17,25):', JSON.stringify(result))

await client.close()
await transport.close()
