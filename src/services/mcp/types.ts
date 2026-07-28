/**
 * MCP Host 侧公共类型
 *
 * 连接成功后，会话里会拿着这些结构去：
 * - 调 MCP Tools（经 clients）
 * - 列/读 Resources
 * - 把 Prompts 变成 REPL 的 `/server:prompt` 命令
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js'
import type { UserMessage } from '../../types/message.js'

/**
 * 一条已连上的 MCP server。
 * `serverId` 来自 `.mcp.json` 的 key（如 `calc`）；后续工具入参里的 `server` 也用它。
 */
export type McpConnectedClient = {
  /** `.mcp.json` 里的 server 名，例如 `calc` / `tour` */
  serverId: string
  /** SDK Client，真正发 resources/list、prompts/get、tools/call */
  client: Client
  /**
   * 握手后 server 声明的能力。
   * 没有 `resources` / `prompts` 时，对应路径直接跳过，不影响 tools。
   */
  capabilities: ServerCapabilities | undefined
  /** 关掉 stdio 进程与连接 */
  close: () => Promise<void>
}

/**
 * 一条 Resource 的摘要（list 的结果）。
 * 模型或 Host 再用 `uri` + `server` 去 read。
 */
export type McpResourceEntry = {
  /** 资源地址，如 `docs://handbook` */
  uri: string
  name: string
  mimeType?: string
  description?: string
  /** 来自哪个 MCP server（多 server 时用来区分） */
  server: string
}

/**
 * 一条可在 REPL 里敲的 MCP Prompt 命令。
 * 例如用户输入：`/calc:plan_trip 石家庄 2`
 */
export type McpSlashCommand = {
  serverId: string
  promptName: string
  /** 程序内部名：`mcp__<server>__<prompt>`（与 tool 命名风格一致） */
  internalName: string
  description: string
  /** prompt 声明的参数名顺序；slash 后面的词按空格拆开后按此顺序填入 */
  argNames: string[]
  /** `/help` 上展示的样子：`server:prompt (MCP)` */
  slashLabel: string
  /**
   * 执行：调 `prompts/get`，把返回的模板转成可注入会话的 user 消息（带 meta）。
   * @param argsLine - slash 后面的参数原文，如 `石家庄 2`
   */
  run: (argsLine: string) => Promise<UserMessage[]>
}
