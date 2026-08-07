import { describe, expect, test } from 'bun:test'
import { formatMarkdown } from '../markdownFormat.js'

describe('formatMarkdown', () => {
  test('renders bold and inline code', () => {
    const out = formatMarkdown('say **hi** and `code`')
    expect(out).toContain('hi')
    expect(out).toContain('code')
    // chalk wraps with ANSI — bold/cyan sequences present
    expect(out).toMatch(/\x1b\[/)
  })

  test('renders fenced code block', () => {
    const out = formatMarkdown('```ts\nconst x = 1\n```')
    expect(out).toContain('const x = 1')
    expect(out).toContain('```')
  })

  test('renders heading and list', () => {
    const out = formatMarkdown('# Title\n\n- a\n- b\n')
    expect(out).toContain('Title')
    expect(out).toContain('a')
    expect(out).toContain('b')
  })

  test('plain text still returns content', () => {
    const out = formatMarkdown('hello world')
    expect(out).toContain('hello world')
  })
})
