import { afterEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { Tool } from '../../Tool.js'
import {
  createHeadlessCanUseTool,
  createReplCanUseTool,
  createSessionPermissionRules,
  USER_REJECT_MESSAGE,
} from '../canUseTool.js'

const writeLikeSchema = z.object({
  file_path: z.string(),
  content: z.string(),
})

function createWriteLikeTool(): Tool<typeof writeLikeSchema> {
  return {
    name: 'Write',
    description: 'write-like',
    inputSchema: writeLikeSchema,
    async call() {
      return { data: 'ok' }
    },
    isReadOnly() {
      return false
    },
    isConcurrencySafe() {
      return false
    },
    isEnabled() {
      return true
    },
  }
}

function createReadLikeTool(): Tool<typeof writeLikeSchema> {
  return {
    ...createWriteLikeTool(),
    name: 'Read',
    isReadOnly() {
      return true
    },
  }
}

describe('createHeadlessCanUseTool', () => {
  const prev = process.env.ALLOW_WRITE

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_WRITE
    else process.env.ALLOW_WRITE = prev
  })

  test('allows read-only tools', async () => {
    delete process.env.ALLOW_WRITE
    const canUse = createHeadlessCanUseTool()
    const result = await canUse(
      createReadLikeTool(),
      { file_path: 'a.txt', content: '' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('denies write tools by default', async () => {
    delete process.env.ALLOW_WRITE
    const canUse = createHeadlessCanUseTool()
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'a.txt', content: 'x' },
      { tools: [] },
    )
    expect(result.behavior).toBe('deny')
    if (result.behavior === 'deny') {
      expect(result.message).toContain('ALLOW_WRITE=1')
    }
  })

  test('allows write tools when ALLOW_WRITE=1', async () => {
    process.env.ALLOW_WRITE = '1'
    const canUse = createHeadlessCanUseTool()
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'a.txt', content: 'x' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
  })
})

describe('createReplCanUseTool', () => {
  test('allows read-only tools without asking', async () => {
    let asked = false
    const canUse = createReplCanUseTool(async () => {
      asked = true
      return 'n'
    })
    const result = await canUse(
      createReadLikeTool(),
      { file_path: 'a.txt', content: '' },
      { tools: [] },
    )
    expect(asked).toBe(false)
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('allows write when user answers y', async () => {
    const prompts: string[] = []
    const canUse = createReplCanUseTool(async prompt => {
      prompts.push(prompt)
      return 'y'
    })
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
    expect(prompts[0]).toContain('out.txt')
    expect(prompts[0]).toContain('2 字节')
  })

  test('denies write and aborts the turn when user answers n', async () => {
    const abortController = new AbortController()
    const canUse = createReplCanUseTool(async () => 'n')
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'hi' },
      { tools: [], abortController },
    )
    expect(result).toEqual({
      behavior: 'deny',
      message: USER_REJECT_MESSAGE,
    })
    expect(abortController.signal.aborted).toBe(true)
  })

  test('Edit confirmation summary includes path and old_string preview', async () => {
    const prompts: string[] = []
    const canUse = createReplCanUseTool(async prompt => {
      prompts.push(prompt)
      return 'y'
    })
    const editTool: Tool = {
      name: 'Edit',
      description: 'edit',
      inputSchema: z.object({
        file_path: z.string(),
        old_string: z.string(),
        new_string: z.string(),
      }),
      async call() {
        return { data: 'ok' }
      },
      isReadOnly() {
        return false
      },
      isConcurrencySafe() {
        return false
      },
      isEnabled() {
        return true
      },
    }
    const result = await canUse(
      editTool,
      { file_path: 'src/a.ts', old_string: 'foo', new_string: 'bar' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
    expect(prompts[0]).toContain('Edit')
    expect(prompts[0]).toContain('src/a.ts')
    expect(prompts[0]).toContain('foo')
  })

  test('Bash confirmation summary includes the command preview', async () => {
    const prompts: string[] = []
    const canUse = createReplCanUseTool(async prompt => {
      prompts.push(prompt)
      return 'y'
    })
    const bashTool: Tool = {
      name: 'Bash',
      description: 'bash',
      inputSchema: z.object({ command: z.string() }),
      async call() {
        return { data: 'ok' }
      },
      isReadOnly() {
        return false
      },
      isConcurrencySafe() {
        return false
      },
      isEnabled() {
        return true
      },
    }
    const result = await canUse(
      bashTool,
      { command: 'rm -rf build' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
    expect(prompts[0]).toContain('rm -rf build')
  })

  test('skips ask when session rule matches tool name', async () => {
    const rules = createSessionPermissionRules()
    rules.allow('Write')
    let asked = false
    const canUse = createReplCanUseTool(async () => {
      asked = true
      return 'n'
    }, rules)
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(asked).toBe(false)
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('still asks when path rule does not match', async () => {
    const rules = createSessionPermissionRules()
    rules.allow('Write', 'src/*')
    let asked = false
    const canUse = createReplCanUseTool(async () => {
      asked = true
      return 'y'
    }, rules)
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'other/out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(asked).toBe(true)
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('always (a) remembers allow and skips later asks', async () => {
    const rules = createSessionPermissionRules()
    const prompts: string[] = []
    const answers = ['a', 'n']
    const canUse = createReplCanUseTool(async prompt => {
      prompts.push(prompt)
      return answers.shift() ?? 'n'
    }, rules)

    const first = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(first).toEqual({ behavior: 'allow' })
    expect(prompts[0]).toContain('[y/a/N]')

    const second = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'again' },
      { tools: [] },
    )
    expect(second).toEqual({ behavior: 'allow' })
    expect(prompts).toHaveLength(1)
  })
})

describe('session permission rules + headless', () => {
  const prev = process.env.ALLOW_WRITE

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOW_WRITE
    else process.env.ALLOW_WRITE = prev
  })

  test('headless allows write when session rule matches', async () => {
    delete process.env.ALLOW_WRITE
    const rules = createSessionPermissionRules()
    rules.allow('Write', 'out.txt')
    const canUse = createHeadlessCanUseTool(rules)
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'x' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('headless still denies write without rule or ALLOW_WRITE', async () => {
    delete process.env.ALLOW_WRITE
    const rules = createSessionPermissionRules()
    const canUse = createHeadlessCanUseTool(rules)
    const result = await canUse(
      createWriteLikeTool(),
      { file_path: 'out.txt', content: 'x' },
      { tools: [] },
    )
    expect(result.behavior).toBe('deny')
  })
})
