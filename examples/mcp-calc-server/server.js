#!/usr/bin/env node
/**
 * 最小 MCP Server 示例：暴露 add / multiply 两个工具。
 *
 * 用法（由 Agent 通过 .mcp.json 以 stdio 拉起，一般不要手动跑）：
 *   bun run examples/mcp-calc-server/server.js
 *
 * 注意：stdout 专供 MCP JSON-RPC；调试信息只能打到 stderr。
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const numberPairSchema = {
  type: 'object',
  properties: {
    a: { type: 'number', description: '第一个数' },
    b: { type: 'number', description: '第二个数' },
  },
  required: ['a', 'b'],
}

const server = new Server(
  { name: 'mcp-calc-demo', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'add',
      description: '计算两个数字的和',
      inputSchema: numberPairSchema,
    },
    {
      name: 'multiply',
      description: '计算两个数字的乘积',
      inputSchema: numberPairSchema,
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  const a = Number(args?.a)
  const b = Number(args?.b)

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      content: [{ type: 'text', text: '参数错误：a、b 必须是数字' }],
      isError: true,
    }
  }

  if (name === 'add') {
    return {
      content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
    }
  }

  if (name === 'multiply') {
    return {
      content: [{ type: 'text', text: `${a} × ${b} = ${a * b}` }],
    }
  }

  return {
    content: [{ type: 'text', text: `未知工具: ${name}` }],
    isError: true,
  }
})

async function main() {
  console.error('[mcp-calc] starting…')
  await server.connect(new StdioServerTransport())
  console.error('[mcp-calc] ready (stdio)')
}

main().catch(err => {
  console.error('[mcp-calc] crashed:', err)
  process.exit(1)
})
