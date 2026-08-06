import { describe, expect, test } from 'bun:test'
import {
  getShellInfoLine,
  resolveBashExecutable,
  type ResolveBashDeps,
} from '../windowsGitBash.js'

function deps(partial: Partial<ResolveBashDeps>): ResolveBashDeps {
  return {
    platform: 'win32',
    env: {},
    existsSync: () => false,
    findGitExecutable: () => null,
    ...partial,
  }
}

describe('resolveBashExecutable', () => {
  test('non-win32 uses SHELL or /bin/bash', () => {
    expect(
      resolveBashExecutable(
        deps({ platform: 'linux', env: { SHELL: '/bin/zsh' } }),
      ),
    ).toBe('/bin/zsh')
    expect(resolveBashExecutable(deps({ platform: 'darwin', env: {} }))).toBe(
      '/bin/bash',
    )
  })

  test('win32 prefers CLAUDE_CODE_GIT_BASH_PATH when file exists', () => {
    const path = 'D:\\Git\\bin\\bash.exe'
    expect(
      resolveBashExecutable(
        deps({
          env: { CLAUDE_CODE_GIT_BASH_PATH: path },
          existsSync: p => p === path,
        }),
      ),
    ).toBe(path)
  })

  test('win32 ignores CLAUDE_CODE_GIT_BASH_PATH when missing', () => {
    expect(
      resolveBashExecutable(
        deps({
          env: {
            CLAUDE_CODE_GIT_BASH_PATH: 'D:\\missing\\bash.exe',
            SHELL: 'C:\\Program Files\\Git\\bin\\bash.exe',
          },
          existsSync: p => p.includes('Program Files'),
        }),
      ),
    ).toBe('C:\\Program Files\\Git\\bin\\bash.exe')
  })

  test('win32 accepts bash-like SHELL when it exists', () => {
    const shell = 'C:\\Tools\\bash.exe'
    expect(
      resolveBashExecutable(
        deps({
          env: { SHELL: shell },
          existsSync: p => p === shell,
        }),
      ),
    ).toBe(shell)
  })

  test('win32 rejects cmd.exe SHELL and continues search', () => {
    expect(
      resolveBashExecutable(
        deps({
          env: { SHELL: 'C:\\Windows\\System32\\cmd.exe' },
          existsSync: () => false,
        }),
      ),
    ).toBeNull()
  })

  test('win32 probes common Git paths', () => {
    const common = 'C:\\Program Files\\Git\\bin\\bash.exe'
    expect(
      resolveBashExecutable(
        deps({
          existsSync: p => p === common,
        }),
      ),
    ).toBe(common)
  })

  test('win32 infers bash from git.exe location', () => {
    const git = 'C:\\Program Files\\Git\\cmd\\git.exe'
    const bash = 'C:\\Program Files\\Git\\bin\\bash.exe'
    expect(
      resolveBashExecutable(
        deps({
          findGitExecutable: () => git,
          existsSync: p => p === bash,
        }),
      ),
    ).toBe(bash)
  })

  test('win32 returns null when nothing found', () => {
    expect(resolveBashExecutable(deps({}))).toBeNull()
  })

  test('getShellInfoLine mentions Unix syntax on Windows', () => {
    expect(getShellInfoLine('win32')).toMatch(/Unix/i)
    expect(getShellInfoLine('linux')).toMatch(/bash/i)
  })
})
