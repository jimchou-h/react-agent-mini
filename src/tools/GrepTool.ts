/**
 * Grep 工具：在 cwd 子树内按正则搜内容
 *
 * 默认 `output_mode=files_with_matches`、`head_limit=250`（对齐 Claude Code）。
 * 也可 content（匹配行）或 count；路径越界拒绝。
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { resolvePathUnderCwd } from './ReadTool.js'

/** Grep 默认 head_limit（0 = 不限） */
export const DEFAULT_GREP_HEAD_LIMIT = 250

/** Grep 输出字符上限（32KB） */
export const MAX_GREP_OUTPUT_CHARS = 32 * 1024

const grepInputSchema = z.object({
  pattern: z.string().describe('要搜索的正则表达式'),
  path: z.string().optional().describe('搜索根路径（相对 cwd，默认 cwd）'),
  glob: z.string().optional().describe('仅匹配该 glob 的文件名'),
  output_mode: z
    .enum(['content', 'files_with_matches', 'count'])
    .optional()
    .describe(
      '输出模式：content 匹配行；files_with_matches 文件列表（默认）；count 计数',
    ),
  head_limit: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('最多返回条目数（默认 250；0 表示不限）'),
})

type GrepOutputMode = 'content' | 'files_with_matches' | 'count'

/**
 * Grep 工具 — 在 cwd 子树内按正则搜索
 */
export const GrepTool: Tool<typeof grepInputSchema> = {
  name: 'Grep',
  description:
    '在当前工作目录内按正则搜索。默认返回匹配文件列表（files_with_matches）',
  inputSchema: grepInputSchema,

  async call(args) {
    const root = resolvePathUnderCwd(args.path ?? '.')
    const rootStat = await stat(root)
    if (!rootStat.isDirectory() && !rootStat.isFile()) {
      throw new Error(`不是可搜索路径: ${args.path ?? '.'}`)
    }

    let regex: RegExp
    try {
      regex = new RegExp(args.pattern)
    } catch {
      throw new Error(`无效的正则表达式: ${args.pattern}`)
    }

    const outputMode: GrepOutputMode = args.output_mode ?? 'files_with_matches'
    const headLimit = args.head_limit ?? DEFAULT_GREP_HEAD_LIMIT
    const unlimited = headLimit === 0

    const files = rootStat.isFile()
      ? [root]
      : await listFilesRecursive(root, args.glob)

    if (outputMode === 'files_with_matches') {
      const matchedFiles: string[] = []
      let truncated = false
      for (const filePath of files) {
        if (!unlimited && matchedFiles.length >= headLimit) {
          truncated = true
          break
        }
        if (await fileHasMatch(filePath, regex)) {
          matchedFiles.push(
            relative(process.cwd(), filePath).replace(/\\/g, '/'),
          )
        }
      }
      return { data: formatOutput(matchedFiles.join('\n'), truncated, headLimit) }
    }

    if (outputMode === 'count') {
      const counts: string[] = []
      let truncated = false
      for (const filePath of files) {
        if (!unlimited && counts.length >= headLimit) {
          truncated = true
          break
        }
        const count = await countMatches(filePath, regex)
        if (count > 0) {
          const displayPath = relative(process.cwd(), filePath).replace(
            /\\/g,
            '/',
          )
          counts.push(`${displayPath}:${count}`)
        }
      }
      return { data: formatOutput(counts.join('\n'), truncated, headLimit) }
    }

    const matches: string[] = []
    let truncated = false
    for (const filePath of files) {
      if (!unlimited && matches.length >= headLimit) {
        truncated = true
        break
      }

      let content: string
      try {
        content = await readFile(filePath, 'utf-8')
      } catch {
        continue
      }

      const lines = content.split(/\r?\n/)
      const displayPath = relative(process.cwd(), filePath).replace(/\\/g, '/')

      for (let i = 0; i < lines.length; i++) {
        if (!unlimited && matches.length >= headLimit) {
          truncated = true
          break
        }
        const line = lines[i]!
        if (regex.test(line)) {
          matches.push(`${displayPath}:${i + 1}:${line}`)
        }
        regex.lastIndex = 0
      }
    }

    return {
      data: formatOutput(matches.join('\n') || '无匹配', truncated, headLimit),
    }
  },

  isReadOnly() {
    return true
  },

  isConcurrencySafe() {
    return true
  },

  isEnabled() {
    return true
  },
}

async function fileHasMatch(filePath: string, regex: RegExp): Promise<boolean> {
  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return false
  }
  for (const line of content.split(/\r?\n/)) {
    if (regex.test(line)) {
      regex.lastIndex = 0
      return true
    }
    regex.lastIndex = 0
  }
  return false
}

async function countMatches(filePath: string, regex: RegExp): Promise<number> {
  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    return 0
  }
  let count = 0
  for (const line of content.split(/\r?\n/)) {
    if (regex.test(line)) count++
    regex.lastIndex = 0
  }
  return count
}

function formatOutput(
  output: string,
  truncated: boolean,
  headLimit: number,
): string {
  let result = output
  if (truncated && headLimit > 0) {
    result += `\n…（已截断，最多 ${headLimit} 条）`
  }
  if (result.length > MAX_GREP_OUTPUT_CHARS) {
    result =
      result.slice(0, MAX_GREP_OUTPUT_CHARS) +
      `\n…（输出超过 ${MAX_GREP_OUTPUT_CHARS / 1024}KB，已截断）`
  }
  return result
}

async function listFilesRecursive(
  dir: string,
  globFilter?: string,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      files.push(...(await listFilesRecursive(full, globFilter)))
    } else if (entry.isFile()) {
      if (globFilter && !matchSimpleGlob(entry.name, globFilter)) continue
      files.push(full)
    }
  }

  return files
}

/** 仅按文件名做 `*` → `.*` 的简易 glob，不是完整路径 glob 引擎 */
function matchSimpleGlob(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(name)
}
