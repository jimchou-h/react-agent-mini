import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CallModelParams } from '../../query/types.js'
import type { AssistantMessage, Message, StreamEvent } from '../../types/message.js'
import { query } from '../../query.js'
import { getTools } from '../../tools/index.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import { createUserMessage, createAssistantMessage } from '../../utils/messages.js'

async function drainQuery(
  gen: AsyncGenerator<
    import('../../types/message.js').QueryYield,
    import('../../query/types.js').Terminal
  >,
) {
  const collected: Array<StreamEvent | Message> = []
  let terminal: import('../../query/types.js').Terminal | undefined
  while (true) {
    const { value, done } = await gen.next()
    if (done) {
      terminal = value
      break
    }
    collected.push(value)
  }
  return { collected, terminal }
}

describe('codebase tools smoke', () => {
  let testDir: string
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    testDir = await mkdtemp(join(tmpdir(), 'codebase-smoke-'))
    process.chdir(testDir)
    await mkdir('src', { recursive: true })
    await writeFile(
      join('src', 'symbol.ts'),
      'export const SMOKE_SYMBOL = "find-me"\n',
      'utf-8',
    )
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    await rm(testDir, { recursive: true, force: true })
  })

  test('Grep finds a symbol then Read returns file content', async () => {
    async function* mockGrepThenRead(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const grepHit = params.messages.find(
        m =>
          m.type === 'user' &&
          m.content.some(
            b =>
              b.type === 'tool_result' &&
              !b.is_error &&
              b.content.includes('SMOKE_SYMBOL'),
          ),
      )

      if (!grepHit) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'toolu_grep_1',
            name: 'Grep',
            input: { pattern: 'SMOKE_SYMBOL' },
          },
        ])
        return
      }

      const readHit = params.messages.find(
        m =>
          m.type === 'user' &&
          m.content.some(
            b =>
              b.type === 'tool_result' &&
              !b.is_error &&
              b.content.includes('find-me'),
          ),
      )

      if (!readHit) {
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'toolu_read_1',
            name: 'Read',
            input: { path: 'src/symbol.ts' },
          },
        ])
        return
      }

      yield createAssistantMessage([
        { type: 'text', text: '找到符号 SMOKE_SYMBOL' },
      ])
    }

    const tools = getTools()
    const context = createMinimalToolContext(tools)

    const { collected, terminal } = await drainQuery(
      query({
        messages: [createUserMessage('找到 SMOKE_SYMBOL 并读取定义')],
        tools,
        toolUseContext: context,
        deps: {
          callModel: mockGrepThenRead,
          uuid: () => 'smoke-uuid',
        },
      }),
    )

    expect(terminal).toEqual({ reason: 'completed' })

    const toolResults = collected
      .filter((m): m is Message & { type: 'user' } => m.type === 'user')
      .flatMap(m => m.content.filter(b => b.type === 'tool_result'))

    expect(
      toolResults.some(
        b =>
          b.type === 'tool_result' &&
          !b.is_error &&
          b.content.includes('SMOKE_SYMBOL'),
      ),
    ).toBe(true)

    expect(
      toolResults.some(
        b =>
          b.type === 'tool_result' &&
          !b.is_error &&
          b.content.includes('find-me'),
      ),
    ).toBe(true)
  })
})
