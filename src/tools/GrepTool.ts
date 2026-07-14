import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { resolvePathUnderCwd } from './ReadTool.js'

/** Grep 默认最多返回的匹配行数 */
export const DEFAULT_GREP_HEAD_LIMIT = 50

/** Grep 输出字符上限（32KB） */
export const MAX_GREP_OUTPUT_CHARS = 32 * 1024

const grepInputSchema = z.object({
  pattern: z.string().describe('要搜索的正则表达式'),
  path: z.string().optional().describe('搜索根路径（相对 cwd，默认 cwd）'),
  glob: z.string().optional().describe('仅匹配该 glob 的文件名'),
  head_limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('最多返回的匹配行数（默认 50）'),
})

/**
 * Grep 工具 — 在 cwd 子树内按正则搜索文件内容
 *
 * 实现：纯 JS 遍历 + RegExp（不依赖系统 rg，便于测试与 Windows）。
 * 结果格式对齐 ripgrep：`path:line:content`
 */
export const GrepTool: Tool<typeof grepInputSchema> = {
  name: 'Grep',
  description:
    '在当前工作目录内按正则搜索文件内容，返回匹配行（路径:行号:内容）',
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

    const headLimit = args.head_limit ?? DEFAULT_GREP_HEAD_LIMIT
    const matches: string[] = []
    let truncated = false

    const files = rootStat.isFile()
      ? [root]
      : await listFilesRecursive(root, args.glob)

    for (const filePath of files) {
      if (matches.length >= headLimit) {
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
        if (matches.length >= headLimit) {
          truncated = true
          break
        }
        const line = lines[i]!
        if (regex.test(line)) {
          matches.push(`${displayPath}:${i + 1}:${line}`)
        }
        // RegExp with /g keeps lastIndex — reset per line for safety
        regex.lastIndex = 0
      }
    }

    let output = matches.join('\n')
    if (truncated) {
      output += `\n…（已截断，最多 ${headLimit} 条）`
    }

    if (output.length > MAX_GREP_OUTPUT_CHARS) {
      output =
        output.slice(0, MAX_GREP_OUTPUT_CHARS) +
        `\n…（输出超过 ${MAX_GREP_OUTPUT_CHARS / 1024}KB，已截断）`
    }

    return { data: output || '无匹配' }
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

/** 极简 glob：仅支持 `*` 通配（如 `*.ts`） */
function matchSimpleGlob(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(name)
}
