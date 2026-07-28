/**
 * MCP stdio 连接与会话组装
 *
 * 读完 `.mcp.json` 之后，这里负责：
 * 1. 起每个 server 的子进程并握手
 * 2. listTools → 适配成带 `mcp__` 前缀的内部 Tool
 * 3. 若有 prompts → 收成 REPL slash 命令
 * 4. 记下 clients / capabilities，供 Resource 工具和 slash 挂载材料用
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Tool, Tools } from '../../Tool.js'
import { adaptMcpTool } from './adapter.js'
import type { McpConfig, McpServerConfig } from './config.js'
import {
  fetchCommandsForClient,
  fetchResourcesForClient,
  sessionHasResources,
} from './fetch.js'
import type { McpConnectedClient, McpSlashCommand } from './types.js'

/**
 * 一次启动连上的全部 MCP 结果。
 * CLI 用 tools 合并进会话、用 commands 喂 REPL、用 clients 给 Resource 工具路由。
 */
export type McpSession = {
  /** 已适配的 MCP Tools（名如 `mcp__calc__add`） */
  tools: Tools
  /** 仍保持连接的 server 句柄 */
  clients: McpConnectedClient[]
  /** 可在 REPL 输入的 MCP Prompt slash 列表 */
  commands: McpSlashCommand[]
  /** 是否至少有一个 server 支持 resources（决定要不要注入 List/Read 工具） */
  hasResources: boolean
  close: () => Promise<void>
}

const CONNECT_TIMEOUT_MS = 15_000
const CALL_TIMEOUT_MS = 30_000

/**
 * 连接配置里的全部 stdio MCP server，并拼出会话句柄。
 *
 * 单个 server 挂了：stderr 警告并跳过，其它 server 继续。
 * 全部挂了：tools / commands 为空，进程仍可只靠内置工具跑。
 */
export async function connectMcpSession(
  config: McpConfig,
  options?: {
    warn?: (message: string) => void
    cwd?: string
  },
): Promise<McpSession> {
  const warn = options?.warn ?? ((msg: string) => console.error(msg))
  const cwd = options?.cwd ?? process.cwd()
  const clients: McpConnectedClient[] = []
  const tools: Tool[] = []
  const commands: McpSlashCommand[] = []

  for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const connected = await connectOneServer(serverId, serverConfig, cwd)
      clients.push(connected)

      // Tools：变成模型可调的 mcp__* 工具
      const listed = await withTimeout(
        connected.client.listTools(),
        CONNECT_TIMEOUT_MS,
        `MCP list_tools 超时 (${serverId})`,
      )
      for (const tool of listed.tools) {
        tools.push(
          adaptMcpTool(serverId, tool, async (name, args) => {
            return withTimeout(
              connected.client.callTool({ name, arguments: args }),
              CALL_TIMEOUT_MS,
              `MCP tools/call 超时 (${serverId}/${name})`,
            )
          }),
        )
      }

      // Prompts：变成 REPL slash；Resources：预探一下（失败只 warn）
      commands.push(...(await fetchCommandsForClient(connected, { warn })))
      await fetchResourcesForClient(connected, { warn })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      warn(`警告: MCP server "${serverId}" 连接失败，已跳过 — ${msg}`)
    }
  }

  return {
    tools,
    clients,
    commands,
    hasResources: sessionHasResources(clients),
    async close() {
      await Promise.allSettled(clients.map(c => c.close()))
    },
  }
}

/**
 * 拉起一个 stdio server：建 transport → connect → 读 capabilities。
 * capabilities 决定后面能不能走 resources / prompts。
 */
async function connectOneServer(
  serverId: string,
  serverConfig: McpServerConfig,
  cwd: string,
): Promise<McpConnectedClient> {
  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env: serverConfig.env,
    cwd,
    stderr: 'pipe',
  })

  const client = new Client({
    name: 'react-agent-mini',
    version: '0.1.0',
  })

  await withTimeout(
    client.connect(transport),
    CONNECT_TIMEOUT_MS,
    `MCP 连接超时 (${serverId})`,
  )

  const capabilities = client.getServerCapabilities()

  return {
    serverId,
    client,
    capabilities,
    async close() {
      try {
        await client.close()
      } catch {
        // ignore
      }
      try {
        await transport.close()
      } catch {
        // ignore
      }
    },
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      err => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/** 合并 builtin 与 MCP 工具；MCP 名已带前缀，不会盖住内置同名工具 */
export function mergeTools(builtin: Tools, mcpTools: Tools): Tools {
  return [...builtin, ...mcpTools]
}
