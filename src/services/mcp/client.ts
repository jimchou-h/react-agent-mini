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

export type McpSession = {
  tools: Tools
  clients: McpConnectedClient[]
  commands: McpSlashCommand[]
  hasResources: boolean
  close: () => Promise<void>
}

const CONNECT_TIMEOUT_MS = 15_000
const CALL_TIMEOUT_MS = 30_000

/**
 * 连接配置中的全部 stdio MCP server，适配工具并返回会话句柄
 *
 * 单个 server 失败时 stderr 警告并跳过；全部失败则 tools 为空数组。
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

/** 合并 builtin 与 MCP 工具；MCP 已带前缀，不会覆盖 builtin 原名 */
export function mergeTools(builtin: Tools, mcpTools: Tools): Tools {
  return [...builtin, ...mcpTools]
}
