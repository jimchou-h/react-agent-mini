/**
 * 项目上下文加载：向上找 AGENTS.md / CLAUDE.md
 *
 * 从 cwd 往上最多 5 层（遇到 `.git` 提前停）。
 * 同目录两个文件都有则合并；总长超 64KB 截断。
 * 找不到任何文件 → undefined（会话仍可跑，只是没有项目说明）。
 */

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const AGENTS_FILE = 'AGENTS.md'
const CLAUDE_FILE = 'CLAUDE.md'
/** 合并 CLAUDE.md 等项目说明后的 UTF-8 字节上限 */
export const MAX_PROJECT_CONTEXT_BYTES = 64 * 1024
const MAX_UP_LEVELS = 5
const MERGE_SEPARATOR = '\n\n---\n\n'
const TRUNCATION_NOTE = '\n\n[project context truncated at 64KB]'

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return undefined
  }
}

/** 读某一目录下的 AGENTS.md / CLAUDE.md（有则合并） */
async function readContextAtDir(dir: string): Promise<string | undefined> {
  const agents = await readOptionalFile(join(dir, AGENTS_FILE))
  const claude = await readOptionalFile(join(dir, CLAUDE_FILE))

  if (agents !== undefined && claude !== undefined) {
    return `${agents}${MERGE_SEPARATOR}${claude}`
  }
  if (agents !== undefined) return agents
  if (claude !== undefined) return claude
  return undefined
}

function isGitRoot(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

function truncateContent(content: string): string {
  if (Buffer.byteLength(content, 'utf-8') <= MAX_PROJECT_CONTEXT_BYTES) {
    return content
  }

  const noteBytes = Buffer.byteLength(TRUNCATION_NOTE, 'utf-8')
  const maxContentBytes = MAX_PROJECT_CONTEXT_BYTES - noteBytes
  let truncated = content
  while (Buffer.byteLength(truncated, 'utf-8') > maxContentBytes) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated}${TRUNCATION_NOTE}`
}

/**
 * 从 cwd 向上发现项目说明文件并返回合并文本。
 * 无文件时返回 undefined。
 */
export async function loadProjectContext(
  startCwd: string = process.cwd(),
): Promise<string | undefined> {
  let dir = startCwd

  for (let level = 0; level <= MAX_UP_LEVELS; level++) {
    const content = await readContextAtDir(dir)
    if (content !== undefined) {
      return truncateContent(content)
    }

    if (isGitRoot(dir)) break

    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return undefined
}
