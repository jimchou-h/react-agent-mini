import { afterEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { Tool } from '../../Tool.js'
import {
  createHeadlessCanUseTool,
  createReplCanUseTool,
} from '../canUseTool.js'

const writeLikeSchema = z.object({
  path: z.string(),
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
      { path: 'a.txt', content: '' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
  })

  test('denies write tools by default', async () => {
    delete process.env.ALLOW_WRITE
    const canUse = createHeadlessCanUseTool()
    const result = await canUse(
      createWriteLikeTool(),
      { path: 'a.txt', content: 'x' },
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
      { path: 'a.txt', content: 'x' },
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
      { path: 'a.txt', content: '' },
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
      { path: 'out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(result).toEqual({ behavior: 'allow' })
    expect(prompts[0]).toContain('out.txt')
    expect(prompts[0]).toContain('2 字节')
  })

  test('denies write when user answers n', async () => {
    const canUse = createReplCanUseTool(async () => 'n')
    const result = await canUse(
      createWriteLikeTool(),
      { path: 'out.txt', content: 'hi' },
      { tools: [] },
    )
    expect(result.behavior).toBe('deny')
  })
})
