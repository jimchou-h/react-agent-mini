/**
 * Windows 上解析 Git Bash（bash.exe）路径
 *
 * 对齐 claude-code `findGitBashPath` 精简版：不 exit 进程，找不到返回 null。
 * 非 Windows 返回 POSIX shell 路径（SHELL 或 /bin/bash）。
 */

import { existsSync as nodeExistsSync } from 'node:fs'
import path from 'node:path'

const COMMON_GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
]

export type ResolveBashDeps = {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  existsSync: (filePath: string) => boolean
  /** 返回 git.exe 绝对路径；无法找到则为 null */
  findGitExecutable: () => string | null
}

function defaultFindGitExecutable(
  existsSync: (p: string) => boolean,
): string | null {
  const defaults = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  ]
  for (const location of defaults) {
    if (existsSync(location)) return location
  }
  return null
}

function isBashLikePath(filePath: string): boolean {
  const base = path.win32.basename(filePath).toLowerCase()
  return base === 'bash.exe' || base === 'bash'
}

/**
 * 解析 Bash 可执行文件路径。
 * - 非 win32：`SHELL` 或 `/bin/bash`（不强制 exists）
 * - win32：按 env → SHELL(bash) → 常见路径 → git 推断；全失败返回 null
 */
export function resolveBashExecutable(
  partial?: Partial<ResolveBashDeps>,
): string | null {
  const platform = partial?.platform ?? process.platform
  const env = partial?.env ?? process.env
  const existsSync = partial?.existsSync ?? nodeExistsSync
  const findGitExecutable =
    partial?.findGitExecutable ?? (() => defaultFindGitExecutable(existsSync))

  if (platform !== 'win32') {
    return env.SHELL || '/bin/bash'
  }

  const fromEnv = env.CLAUDE_CODE_GIT_BASH_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv
  }

  const shell = env.SHELL?.trim()
  if (shell && isBashLikePath(shell) && existsSync(shell)) {
    return shell
  }

  for (const candidate of COMMON_GIT_BASH_PATHS) {
    if (existsSync(candidate)) return candidate
  }

  const gitPath = findGitExecutable()
  if (gitPath) {
    const bashPath = path.win32.join(gitPath, '..', '..', 'bin', 'bash.exe')
    if (existsSync(bashPath)) return bashPath
  }

  return null
}

/** 找不到 Git Bash 时返回给模型的错误文案 */
export function missingGitBashMessage(): string {
  return [
    'Windows 上 Bash 需要 Git Bash（https://git-scm.com/downloads/win）。',
    '若已安装但不在默认路径，请设置 CLAUDE_CODE_GIT_BASH_PATH 指向 bash.exe，例如：',
    'CLAUDE_CODE_GIT_BASH_PATH=C:\\Program Files\\Git\\bin\\bash.exe',
  ].join(' ')
}

/**
 * 注入 system prompt 的 shell 提示（对齐 CC getShellInfoLine 精简版）
 */
export function getShellInfoLine(
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === 'win32') {
    return 'Shell: bash (use Unix shell syntax, not Windows — e.g., /dev/null not NUL, forward slashes in paths)'
  }
  return 'Shell: bash (Unix shell syntax)'
}
