#!/usr/bin/env bun
/**
 * @file CLI 入口 — headless 单次问答
 *
 * 职责：
 * 1. 解析命令行参数 / stdin（pipe 模式）
 * 2. 检查 mock 模式或 API Key
 * 3. 调用 query() 并消费 yield 的事件，输出到终端
 *
 * Windows 推荐：npx bun run dev:mock -- "你的问题"
 */

import { query } from '../query.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createUserMessage } from '../utils/messages.js'
import { extractToolUseBlocks } from '../utils/messages.js'
import {
  formatToolResultStatus,
  formatToolStartStatus,
  isMockMode,
  parseUserPrompt,
} from './cliHelpers.js'

/**
 * 从标准输入读取用户问题（pipe 模式）
 */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf-8').trim()
}

/** 参数错误时打印用法说明到 stderr */
function printUsage(): void {
  console.error('用法:')
  console.error('  npx bun run dev:mock -- "你的问题"     （Windows 推荐，无需 API Key）')
  console.error('  npx bun run dev -- "你的问题"          （需 OPENAI_API_KEY）')
  console.error('  echo "你的问题" | npx bun run dev -p   （pipe 模式）')
  console.error('')
  console.error('PowerShell 环境变量写法:')
  console.error('  $env:QUERY_MOCK="1"; npx bun run dev -- "你的问题"')
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (isMockMode(argv)) {
    process.env.QUERY_MOCK = '1'
  }

  let prompt = parseUserPrompt(argv)

  if (prompt === null && argv.includes('-p')) {
    prompt = await readStdin()
  }

  if (!prompt) {
    printUsage()
    process.exit(1)
  }

  if (!isMockMode(argv) && !process.env.OPENAI_API_KEY) {
    console.error('错误: 未设置 OPENAI_API_KEY。')
    console.error('本地验收请用: npx bun run dev:mock -- "你的问题"')
    process.exit(1)
  }

  const tools = getTools()
  const context = createMinimalToolContext(tools)
  const messages = [createUserMessage(prompt)]

  /** 本 turn 是否已通过 text_delta 流式输出过文本（避免与 assistant 全文重复打印） */
  let printedTextThisTurn = false

  try {
    for await (const item of query({ messages, tools, toolUseContext: context })) {
      if (item.type === 'text_delta') {
        process.stdout.write(item.text)
        printedTextThisTurn = true
      } else if (item.type === 'assistant') {
        for (const block of extractToolUseBlocks(item)) {
          console.error(formatToolStartStatus(block))
        }

        if (!printedTextThisTurn) {
          const text = item.content
            .filter(b => b.type === 'text')
            .map(b => (b.type === 'text' ? b.text : ''))
            .join('')
          if (text) process.stdout.write(text)
        }
        printedTextThisTurn = false
      } else if (item.type === 'user') {
        const toolBlock = item.content.find(b => b.type === 'tool_result')
        if (toolBlock?.type === 'tool_result') {
          const resultLine = formatToolResultStatus(toolBlock)
          if (resultLine) {
            console.error(resultLine)
          }
        }
      }
    }
    process.stdout.write('\n')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`错误: ${msg}`)
    process.exit(1)
  }
}

main()
