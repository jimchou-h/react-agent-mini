#!/usr/bin/env bun
/**
 * @file CLI 入口 — headless / pipe / REPL 路由
 *
 * Windows 推荐：npx bun run dev:mock -- "你的问题"
 */

import { query } from '../query.js'
import { QueryEngine } from '../QueryEngine.js'
import type { DiscoveredSkill } from '../skills/discover.js'
import { loadSessionContext } from '../skills/systemPrompt.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createHeadlessCanUseTool, createReplCanUseTool } from '../permissions/canUseTool.js'
import { createUserMessage } from '../utils/messages.js'
import { consumeQueryStream } from './consumeQueryStream.js'
import { runRepl } from './repl.js'
import {
  isMockMode,
  parseUserPrompt,
  resolveLaunchMode,
  traceCliStart,
} from './cliHelpers.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8').trim()
}

function printUsage(): void {
  console.error('用法:')
  console.error(
    '  npx bun run dev:mock -- "你的问题"     （Windows 推荐，无需 API Key）',
  )
  console.error('  npx bun run dev -- "你的问题"          （需 OPENAI_API_KEY）')
  console.error('  npx bun run dev                        （交互 REPL）')
  console.error('  echo "你的问题" | npx bun run dev -p   （pipe 模式）')
  console.error('')
  console.error('PowerShell 环境变量写法:')
  console.error('  $env:QUERY_MOCK="1"; npx bun run dev -- "你的问题"')
}

function ensureAuth(argv: string[]): void {
  if (!isMockMode(argv) && !process.env.OPENAI_API_KEY) {
    console.error('错误: 未设置 OPENAI_API_KEY。')
    console.error('本地验收请用: npx bun run dev:mock')
    process.exit(1)
  }
}

async function runHeadless(
  prompt: string,
  systemPrompt?: string,
  skills?: readonly DiscoveredSkill[],
): Promise<void> {
  const tools = getTools()
  const context = {
    ...createMinimalToolContext(tools, skills),
    canUseTool: createHeadlessCanUseTool(),
  }
  const messages = [createUserMessage(prompt)]
  await consumeQueryStream(
    query({ messages, tools, toolUseContext: context, systemPrompt }),
  )
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (isMockMode(argv)) {
    process.env.QUERY_MOCK = '1'
  }

  const mode = resolveLaunchMode(argv)
  ensureAuth(argv)
  traceCliStart(mode)

  try {
    const { systemPrompt, skills } = await loadSessionContext()

    if (mode === 'pipe') {
      const prompt = await readStdin()
      if (!prompt) {
        printUsage()
        process.exit(1)
      }
      await runHeadless(prompt, systemPrompt, skills)
      return
    }

    if (mode === 'headless') {
      const prompt = parseUserPrompt(argv)
      if (!prompt) {
        printUsage()
        process.exit(1)
      }
      await runHeadless(prompt, systemPrompt, skills)
      return
    }

    // REPL — 单一 readline，权限确认与提示符共用
    const tools = getTools()
    const readline = await import('node:readline/promises')
    const { stdin: input, stdout: output } = await import('node:process')
    const rl = readline.createInterface({ input, output })
    const ask = async (prompt: string): Promise<string> => rl.question(prompt)
    const engine = new QueryEngine({
      tools,
      toolUseContext: {
        ...createMinimalToolContext(tools, skills),
        canUseTool: createReplCanUseTool(ask),
      },
      systemPrompt,
    })
    try {
      await runRepl(engine, rl)
    } finally {
      rl.close()
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`错误: ${msg}`)
    process.exit(1)
  }
}

main()
