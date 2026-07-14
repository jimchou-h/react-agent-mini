import type { Terminal } from '../query/types.js'
import type { QueryYield } from '../types/message.js'
import { extractToolUseBlocks } from '../utils/messages.js'
import { formatToolResultStatus, formatToolStartStatus } from './cliHelpers.js'

/** 可注入的输出端，便于测试；默认绑定 process.stdout / stderr */
export type StreamWriters = {
  stdout: { write(chunk: string): void }
  stderr: { write(chunk: string): void }
}

const defaultWriters: StreamWriters = {
  stdout: {
    write(chunk) {
      process.stdout.write(chunk)
    },
  },
  stderr: {
    write(chunk) {
      process.stderr.write(chunk)
    },
  },
}

/**
 * 消费 query / runTurn 生成器并打印到终端
 *
 * 约定：text → stdout；工具状态 / 错误 → stderr。
 * REPL 与 headless 共用，避免双份流式打印逻辑。
 */
export async function consumeQueryStream(
  gen: AsyncGenerator<QueryYield, Terminal>,
  writers: StreamWriters = defaultWriters,
): Promise<Terminal> {
  let printedTextThisTurn = false
  let terminal: Terminal = { reason: 'completed' }

  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      terminal = value
      break
    }

    const item = value
    if (item.type === 'text_delta') {
      writers.stdout.write(item.text)
      printedTextThisTurn = true
      continue
    }

    if (item.type === 'assistant') {
      for (const block of extractToolUseBlocks(item)) {
        writers.stderr.write(`${formatToolStartStatus(block)}\n`)
      }

      if (!printedTextThisTurn) {
        const text = item.content
          .filter(b => b.type === 'text')
          .map(b => (b.type === 'text' ? b.text : ''))
          .join('')
        if (text) writers.stdout.write(text)
      }
      printedTextThisTurn = false
      continue
    }

    if (item.type === 'user') {
      const toolBlock = item.content.find(b => b.type === 'tool_result')
      if (toolBlock?.type === 'tool_result') {
        const resultLine = formatToolResultStatus(toolBlock)
        if (resultLine) writers.stderr.write(`${resultLine}\n`)
      }
    }
  }

  writers.stdout.write('\n')
  return terminal
}
