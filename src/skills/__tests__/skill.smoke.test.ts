import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { query } from '../../query.js'
import type { CallModelParams, Terminal } from '../../query/types.js'
import { createMinimalToolContext } from '../../testing/fixtures.js'
import type {
  AssistantMessage,
  QueryYield,
  StreamEvent,
} from '../../types/message.js'
import { createAssistantMessage, createUserMessage } from '../../utils/messages.js'
import { getTools } from '../../tools/index.js'
import { loadSessionContext } from '../systemPrompt.js'

describe('Skill end-to-end', () => {
  test('discovers echo-demo, loads it with Skill, then cites its instructions', async () => {
    const workspace = resolve(import.meta.dir, '../../..')
    const session = await loadSessionContext(workspace)
    const tools = getTools()

    async function* mockSkillThenReply(
      params: CallModelParams,
    ): AsyncGenerator<StreamEvent | AssistantMessage> {
      const skillResult = params.messages
        .filter(message => message.type === 'user')
        .flatMap(message => message.content)
        .find(
          block =>
            block.type === 'tool_result' &&
            block.content.includes('Skill says:'),
        )

      if (!skillResult) {
        expect(params.systemPrompt).toContain('echo-demo')
        yield createAssistantMessage([
          {
            type: 'tool_use',
            id: 'toolu_echo_demo',
            name: 'Skill',
            input: { skill: 'echo-demo' },
          },
        ])
        return
      }

      yield { type: 'text_delta', text: 'Skill says: hello' }
      yield createAssistantMessage([
        { type: 'text', text: 'Skill says: hello' },
      ])
    }

    const generator = query({
      messages: [createUserMessage('Use echo-demo for hello')],
      tools,
      toolUseContext: createMinimalToolContext(tools, session.skills),
      systemPrompt: session.systemPrompt,
      deps: {
        callModel: mockSkillThenReply,
        uuid: () => 'skill-smoke-uuid',
      },
    })

    const events: QueryYield[] = []
    let terminal: Terminal | undefined
    while (true) {
      const next = await generator.next()
      if (next.done) {
        terminal = next.value
        break
      }
      events.push(next.value)
    }

    expect(terminal).toEqual({ reason: 'completed' })
    expect(
      events.some(
        event =>
          event.type === 'user' &&
          event.content.some(
            block =>
              block.type === 'tool_result' &&
              block.content.includes('Skill says:'),
          ),
      ),
    ).toBe(true)
    expect(
      events.some(
        event =>
          event.type === 'text_delta' &&
          event.text === 'Skill says: hello',
      ),
    ).toBe(true)
  })
})
