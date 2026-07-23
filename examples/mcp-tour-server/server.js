#!/usr/bin/env node
/**
 * MCP 概念演示 Server：同时暴露 Tools / Resources / Prompts。
 * 配合 docs/blog/mcp-concepts.md 阅读；stdout 专供 JSON-RPC。
 *
 *   node examples/mcp-tour-server/smoke.mjs
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const HANDBOOK = `# 差旅手册（Demo）

1. 经济舱优先；单程超过 4 小时可升舱。
2. 酒店不超过城市均价 1.2 倍。
3. 出差需提前在日历登记。
`

const server = new Server(
  { name: 'mcp-tour-demo', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
)

// ——— Tools：做事 ———
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'add',
      description: '计算两个数字的和（Tools Demo）',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number', description: '第一个数' },
          b: { type: 'number', description: '第二个数' },
        },
        required: ['a', 'b'],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params
  if (name !== 'add') {
    return {
      content: [{ type: 'text', text: `未知工具: ${name}` }],
      isError: true,
    }
  }
  const a = Number(args?.a)
  const b = Number(args?.b)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      content: [{ type: 'text', text: '参数错误：a、b 必须是数字' }],
      isError: true,
    }
  }
  return {
    content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
  }
})

// ——— Resources：给材料 ———
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'docs://handbook',
      name: '差旅手册',
      description: '公司差旅政策摘要（Resources Demo）',
      mimeType: 'text/markdown',
    },
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params
  if (uri !== 'docs://handbook') {
    throw new Error(`未知 Resource: ${uri}`)
  }
  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: HANDBOOK,
      },
    ],
  }
})

// ——— Prompts：给开场白 ———
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'plan_trip',
      description: '生成差旅规划开场白（Prompts Demo）',
      arguments: [
        { name: 'city', description: '目的地城市', required: true },
        { name: 'days', description: '出行天数', required: true },
      ],
    },
  ],
}))

server.setRequestHandler(GetPromptRequestSchema, async request => {
  const { name, arguments: args } = request.params
  if (name !== 'plan_trip') {
    throw new Error(`未知 Prompt: ${name}`)
  }
  const city = args?.city ?? '未指定城市'
  const days = args?.days ?? '?'
  return {
    description: `为 ${city} ${days} 天行程生成开场`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `请帮我规划去「${city}」的 ${days} 天差旅。`,
            '要求：先阅读差旅手册（若已挂载），再给出日程草案。',
            '不要编造公司政策；政策以手册为准。',
          ].join('\n'),
        },
      },
    ],
  }
})

async function main() {
  console.error('[mcp-tour] starting…')
  await server.connect(new StdioServerTransport())
  console.error('[mcp-tour] ready (tools + resources + prompts)')
}

main().catch(err => {
  console.error('[mcp-tour] crashed:', err)
  process.exit(1)
})
