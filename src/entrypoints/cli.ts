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

/** 解析参数时需忽略的 CLI 标志位 */
const CLI_FLAGS = new Set(['-p', '--mock', '-m'])

/**
 * 从 process.argv 解析用户问题文本
 *
 * 支持两种传参方式：
 * - `bun run dev -- "问题"` → argv 含 `--` 后的内容
 * - `bun run dev:mock "问题"` → 直接 positional 参数（无 `--`）
 *
 * @param argv - process.argv.slice(2)
 * @returns 用户问题字符串；pipe 模式（-p）返回 null
 */
function parseUserPrompt(argv: string[]): string | null {
  if (argv.includes('-p')) {
    return null // pipe：由 readStdin() 提供
  }

  const dashIndex = argv.indexOf('--')
  if (dashIndex >= 0 && argv[dashIndex + 1]) {
    return argv
      .slice(dashIndex + 1)
      .filter(a => !CLI_FLAGS.has(a))
      .join(' ')
      .trim()
  }

  const positional = argv.filter(a => !a.startsWith('-') && a !== '--')
  if (positional.length > 0) {
    return positional.join(' ').trim()
  }

  return null
}

/**
 * 判断是否启用 mock 模型（无需 API Key）
 *
 * 任一条件满足即可：环境变量 QUERY_MOCK=1、--mock、-m
 */
function isMockMode(argv: string[]): boolean {
  return (
    process.env.QUERY_MOCK === '1' ||
    argv.includes('--mock') ||
    argv.includes('-m')
  )
}

/**
 * 从标准输入读取用户问题（pipe 模式）
 *
 * @returns 去除首尾空白后的 stdin 全文
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
  console.error('  npx bun run dev -- "你的问题"          （需 OPENAI_API_KEY，见 issue #2）')
  console.error('')
  console.error('PowerShell 环境变量写法:')
  console.error('  $env:QUERY_MOCK="1"; npx bun run dev -- "你的问题"')
}

/**
 * CLI 主函数
 *
 * 流程：解析 prompt → 校验环境 → query() 循环 → 流式/工具状态输出
 */
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
          const preview =
            toolBlock.content.length > 60
              ? `${toolBlock.content.slice(0, 60)}…`
              : toolBlock.content
          console.error(
            `[工具] tool_result: ${toolBlock.is_error ? '错误' : '成功'} — ${preview}`,
          )
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
