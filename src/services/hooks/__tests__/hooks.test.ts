import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  isHooksDisabled,
  loadHooksConfig,
  parseHooksConfig,
} from '../load.js'
import {
  matchHook,
  runPreToolUse,
  runPostToolUse,
} from '../run.js'
import type { HookExecFn, HooksConfig } from '../types.js'

describe('parseHooksConfig / loadHooksConfig', () => {
  test('parses top-level PreToolUse entries', () => {
    const cfg = parseHooksConfig({
      PreToolUse: [{ matcher: 'Bash', command: 'echo deny' }],
    })
    expect(cfg.PreToolUse).toHaveLength(1)
    expect(cfg.PreToolUse![0]!.matcher).toBe('Bash')
  })

  test('parses nested hooks key', () => {
    const cfg = parseHooksConfig({
      hooks: {
        PostToolUse: [{ matcher: '*', command: 'echo ok' }],
      },
    })
    expect(cfg.PostToolUse).toHaveLength(1)
  })

  test('returns null when file missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hooks-miss-'))
    try {
      expect(loadHooksConfig(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('loads valid .agents/hooks.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hooks-ok-'))
    try {
      mkdirSync(join(dir, '.agents'))
      writeFileSync(
        join(dir, '.agents', 'hooks.json'),
        JSON.stringify({
          PreToolUse: [{ matcher: 'Bash', command: 'node deny.js' }],
        }),
        'utf8',
      )
      const cfg = loadHooksConfig(dir)
      expect(cfg?.PreToolUse?.[0]?.command).toBe('node deny.js')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('HOOKS=0 disables loading', () => {
    const prev = process.env.HOOKS
    process.env.HOOKS = '0'
    try {
      expect(isHooksDisabled()).toBe(true)
      const dir = mkdtempSync(join(tmpdir(), 'hooks-off-'))
      try {
        mkdirSync(join(dir, '.agents'))
        writeFileSync(
          join(dir, '.agents', 'hooks.json'),
          JSON.stringify({
            PreToolUse: [{ matcher: '*', command: 'x' }],
          }),
          'utf8',
        )
        expect(loadHooksConfig(dir)).toBeNull()
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    } finally {
      if (prev == null) delete process.env.HOOKS
      else process.env.HOOKS = prev
    }
  })

  test('invalid JSON fail-soft to null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hooks-bad-'))
    try {
      mkdirSync(join(dir, '.agents'))
      writeFileSync(join(dir, '.agents', 'hooks.json'), '{not-json', 'utf8')
      expect(loadHooksConfig(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('matchHook / runPreToolUse', () => {
  test('matcher * and exact', () => {
    expect(matchHook('*', 'Bash')).toBe(true)
    expect(matchHook('Bash', 'Bash')).toBe(true)
    expect(matchHook('Bash', 'Read')).toBe(false)
  })

  test('no config allows', async () => {
    const d = await runPreToolUse(null, 'Bash', { command: 'ls' })
    expect(d.behavior).toBe('allow')
  })

  test('exit 2 denies', async () => {
    const exec: HookExecFn = async () => ({
      exitCode: 2,
      stdout: '',
      stderr: 'blocked',
    })
    const cfg: HooksConfig = {
      PreToolUse: [{ matcher: 'Bash', command: 'deny' }],
    }
    const d = await runPreToolUse(cfg, 'Bash', {}, { exec })
    expect(d.behavior).toBe('deny')
    expect(d.message).toContain('blocked')
  })

  test('stdout permissionDecision deny', async () => {
    const exec: HookExecFn = async () => ({
      exitCode: 0,
      stdout: JSON.stringify({
        permissionDecision: 'deny',
        permissionDecisionReason: 'policy',
      }),
      stderr: '',
    })
    const cfg: HooksConfig = {
      PreToolUse: [{ matcher: 'Spy', command: 'x' }],
    }
    const d = await runPreToolUse(cfg, 'Spy', { value: '1' }, { exec })
    expect(d).toEqual({ behavior: 'deny', message: 'policy' })
  })

  test('unmatched matcher skips', async () => {
    let called = false
    const exec: HookExecFn = async () => {
      called = true
      return { exitCode: 2, stdout: '', stderr: 'x' }
    }
    const cfg: HooksConfig = {
      PreToolUse: [{ matcher: 'Bash', command: 'x' }],
    }
    const d = await runPreToolUse(cfg, 'Read', {}, { exec })
    expect(d.behavior).toBe('allow')
    expect(called).toBe(false)
  })

  test('non-zero exit fail-soft allows unless denyOnFailure', async () => {
    const exec: HookExecFn = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'oops',
    })
    const soft = await runPreToolUse(
      { PreToolUse: [{ matcher: '*', command: 'x' }] },
      'Echo',
      {},
      { exec },
    )
    expect(soft.behavior).toBe('allow')

    const hard = await runPreToolUse(
      {
        PreToolUse: [{ matcher: '*', command: 'x', denyOnFailure: true }],
      },
      'Echo',
      {},
      { exec },
    )
    expect(hard.behavior).toBe('deny')
  })
})

describe('runPostToolUse', () => {
  test('failure does not throw', async () => {
    const errors: string[] = []
    const prev = console.error
    console.error = (...args: unknown[]) => {
      errors.push(String(args[0]))
    }
    try {
      const exec: HookExecFn = async () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'post-fail',
      })
      await runPostToolUse(
        { PostToolUse: [{ matcher: '*', command: 'x' }] },
        'Echo',
        { message: 'hi' },
        { text: 'hi', isError: false },
        { exec },
      )
      expect(errors.some(e => e.includes('PostToolUse'))).toBe(true)
    } finally {
      console.error = prev
    }
  })
})
