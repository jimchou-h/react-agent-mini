#!/usr/bin/env bun
/**
 * @file CLI 入口 — headless 单次问答
 *
 * 职责：
 * 1. 解析命令行参数 / stdin（pipe 模式）
 * 2. 检查 mock 模式或 API Key
 * 3. 调用 query() 并经 consumeQueryStream 输出到终端
 *
 * Windows 推荐：npx bun run dev:mock -- "你的问题"
 */

import { query } from '../query.js'
import { getTools } from '../tools/index.js'
import { createMinimalToolContext } from '../testing/fixtures.js'
import { createUserMessage } from '../utils/messages.js'
import { consumeQueryStream } from './consumeQueryStream.js'
import { isMockMode, parseUserPrompt } from './cliHelpers.js'

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
  console.error(
    '  npx bun run dev:mock -- "你的问题"     （Windows 推荐，无需 API Key）',
  )
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

  try {
    await consumeQueryStream(
      query({ messages, tools, toolUseContext: context }),
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`错误: ${msg}`)
    process.exit(1)
  }
}

main()
