/**
 * REPL：读用户输入 → 本地 slash / MCP slash / 普通对话
 *
 * MCP 相关路径：
 * - `/tour:plan_trip …`：prompts/get → 按返回文本中 `@server:uri` 挂 Resource → 注入开场
 * - 普通消息含 `@server:uri`：按需挂 Resource，再发送用户原文（对齐 CC）
 */

import type { QueryEngine } from '../QueryEngine.js'
import {
  estimateContextUsage,
  formatContextUsage,
} from '../services/compact/contextUsage.js'
import { resolvePromptResourceMessages } from '../services/mcp/fetch.js'
import type { McpConnectedClient, McpSlashCommand } from '../services/mcp/types.js'
import { formatMcpHelpLines, parseMcpSlashCommand } from '../services/mcp/promptSlash.js'
import { createUserMessage } from '../utils/messages.js'
import { consumeQueryStream } from './consumeQueryStream.js'

/** 轮次结束后打印上下文占用（估算或 lastUsage） */
function printContextUsage(engine: QueryEngine, print: (text: string) => void): void {
  const estimate = estimateContextUsage(engine.messages, {
    usage: engine.lastUsage ?? null,
  })
  print(formatContextUsage(estimate))
}

/** 空行（仅空白）不发起 query */
export function isSkippableReplLine(line: string): boolean {
  return line.trim().length === 0
}

/** 本地 slash：exit / clear / help（不含 MCP `/server:prompt`） */
export type SlashCommand =
  | { type: 'exit' }
  | { type: 'clear' }
  | { type: 'help' }

const BASE_HELP_TEXT = `可用命令:
  /exit, /quit  — 退出 REPL
  /clear        — 清空会话历史
  /help         — 显示本帮助`

/** 拼本地帮助 + 可选 MCP prompt 列表 */
export function buildHelpText(mcpCommands: readonly McpSlashCommand[] = []): string {
  const mcpLines = formatMcpHelpLines(mcpCommands)
  if (mcpLines.length === 0) {
    return BASE_HELP_TEXT
  }
  // 有 MCP prompt 时追加一节，方便用户照着抄
  return `${BASE_HELP_TEXT}\n\nMCP prompts:\n${mcpLines.join('\n')}`
}

/**
 * 解析本地 slash 命令；普通输入或未知 `/xxx` 返回 null（未知不送 slash，也不当模型输入——见 session）
 *
 * 未知 `/foo`：按 AC「slash 输入不作为模型 user」——打印提示，不 runTurn。
 */
export function parseSlashCommand(line: string): SlashCommand | null {
  const trimmed = line.trim()
  if (trimmed === '/exit' || trimmed === '/quit') {
    return { type: 'exit' }
  }
  if (trimmed === '/clear') {
    return { type: 'clear' }
  }
  if (trimmed === '/help') {
    return { type: 'help' }
  }
  return null
}

/** 是否以 `/` 开头（本地或 MCP slash；未知 slash 也不当普通 user 送模型） */
export function isSlashLine(line: string): boolean {
  return line.trim().startsWith('/')
}

/** runReplSession 可注入依赖（engine / 行流 / MCP / 测试钩子） */
export type ReplSessionDeps = {
  engine: QueryEngine
  lines: AsyncIterable<string>
  consume?: typeof consumeQueryStream
  onAfterTurn?: () => void
  /** 测试可捕获帮助/确认输出 */
  print?: (text: string) => void
  mcpCommands?: readonly McpSlashCommand[]
  /** 已连接 MCP clients；slash 时用于挂载同 server 的 Resources */
  mcpClients?: readonly McpConnectedClient[]
}

/**
 * REPL 会话核心循环（无 readline 依赖，便于单测）
 */
export async function runReplSession(deps: ReplSessionDeps): Promise<void> {
  const consume = deps.consume ?? consumeQueryStream
  const print = deps.print ?? ((text: string) => console.log(text))
  const mcpCommands = deps.mcpCommands ?? []
  const mcpClients = deps.mcpClients ?? []

  for await (const line of deps.lines) {
    if (isSkippableReplLine(line)) {
      deps.onAfterTurn?.()
      continue
    }

    const trimmed = line.trim()
    const slash = parseSlashCommand(trimmed)

    if (slash?.type === 'exit') {
      break
    }
    if (slash?.type === 'clear') {
      deps.engine.clear()
      print('会话已清空')
      deps.onAfterTurn?.()
      continue
    }
    if (slash?.type === 'help') {
      print(buildHelpText(mcpCommands))
      deps.onAfterTurn?.()
      continue
    }

    // MCP slash：先 get prompt，再仅按 @server:uri 挂材料，然后开一轮
    const mcpSlash = parseMcpSlashCommand(trimmed, mcpCommands)
    if (mcpSlash) {
      try {
        const promptMessages = await mcpSlash.command.run(mcpSlash.argsLine)
        const resources = await resolvePromptResourceMessages(
          mcpClients,
          promptMessages,
          { warn: msg => print(msg) },
        )
        if (resources.length > 0) {
          print(
            `已挂载 MCP Resource ×${resources.length}（server=${mcpSlash.command.serverId}）`,
          )
        }
        await consume(
          deps.engine.runTurn('', {
            injectBefore: [...resources, ...promptMessages],
          }),
        )
        printContextUsage(deps.engine, print)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        print(`MCP prompt 失败: ${msg}`)
      }
      deps.onAfterTurn?.()
      continue
    }

    // 未知 `/...`：只提示，不 runTurn（slash 原文永不作为模型 user）
    if (isSlashLine(trimmed)) {
      if (trimmed.includes(':') && mcpCommands.length > 0) {
        print(
          `未知 MCP 命令。可用：\n${formatMcpHelpLines(mcpCommands).join('\n')}\n或输入 /help`,
        )
      } else if (trimmed.includes(':') && mcpCommands.length === 0) {
        print(
          '未知命令。当前未注册任何 MCP prompt（server 需声明 prompts 能力）。输入 /help 查看可用命令。',
        )
      } else {
        print('未知命令。输入 /help 查看可用命令。')
      }
      deps.onAfterTurn?.()
      continue
    }

    try {
      // 普通消息：与 CC 一样解析用户原文里的 @server:uri，材料在前、原文在后
      const resources = await resolvePromptResourceMessages(
        mcpClients,
        [createUserMessage(trimmed)],
        { warn: msg => print(msg) },
      )
      if (resources.length > 0) {
        print(`已挂载 MCP Resource ×${resources.length}`)
      }
      await consume(
        deps.engine.runTurn(trimmed, {
          injectBefore: resources.length > 0 ? resources : undefined,
        }),
      )
      printContextUsage(deps.engine, print)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`错误: ${msg}`)
    }
    deps.onAfterTurn?.()
  }
}

type ReadlineInterface = {
  question: (query: string) => Promise<string>
  close: () => void
}

/**
 * 用 rl.question 驱动行迭代，便于与权限确认共用同一 Interface
 */
export async function* linesFromReadlineQuestions(
  rl: ReadlineInterface,
  prompt = '> ',
): AsyncGenerator<string> {
  while (true) {
    try {
      yield await rl.question(prompt)
    } catch {
      break
    }
  }
}

/**
 * 绑定 node:readline 的 REPL 入口
 *
 * @param engine - 会话引擎
 * @param existingRl - 可选：由 CLI 创建并注入 ask 的同一 readline，避免双开冲突
 */
export async function runRepl(
  engine: QueryEngine,
  existingRl?: import('node:readline/promises').Interface,
  options?: {
    mcpCommands?: readonly McpSlashCommand[]
    mcpClients?: readonly McpConnectedClient[]
  },
): Promise<void> {
  if (existingRl) {
    await runReplSession({
      engine,
      lines: linesFromReadlineQuestions(existingRl),
      mcpCommands: options?.mcpCommands,
      mcpClients: options?.mcpClients,
    })
    return
  }

  const readline = await import('node:readline/promises')
  const { stdin: input, stdout: output } = await import('node:process')
  const rl = readline.createInterface({ input, output })

  try {
    await runReplSession({
      engine,
      lines: linesFromReadlineQuestions(rl),
      mcpCommands: options?.mcpCommands,
      mcpClients: options?.mcpClients,
    })
  } finally {
    rl.close()
  }
}
