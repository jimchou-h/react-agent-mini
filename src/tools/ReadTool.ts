import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'
import type { Tool } from '../Tool.js'

/** Read 工具单文件大小上限（100KB） */
export const MAX_READ_BYTES = 100 * 1024

const readInputSchema = z.object({
  path: z.string().describe('要读取的文件路径（相对 cwd 或绝对路径）'),
  offset: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('起始行号（1-based），与 limit 一起分段读取'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('读取行数，与 offset 一起分段读取'),
})

/**
 * 将用户路径解析为绝对路径，并校验落在 cwd 子树内
 *
 * 防止 `../../etc/passwd` 等路径穿越；与 claude-code Read 工具策略一致。
 */
export function resolvePathUnderCwd(
  inputPath: string,
  cwd = process.cwd(),
): string {
  const absolute = resolve(cwd, inputPath)
  const rel = relative(cwd, absolute)

  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('拒绝访问：路径必须在当前工作目录内')
  }

  return absolute
}

/**
 * Read 工具 — 读取 cwd 内普通文件的 UTF-8 文本
 *
 * 约束：路径在 cwd 子树、单文件 ≤100KB、只读、v0 auto-allow。
 */
export const ReadTool: Tool<typeof readInputSchema> = {
  name: 'Read',
  description: '读取本地文本文件内容（UTF-8），路径必须在当前工作目录内',
  inputSchema: readInputSchema,

  async call(args) {
    const filePath = resolvePathUnderCwd(args.path)

    let fileStat
    try {
      fileStat = await stat(filePath)
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as NodeJS.ErrnoException).code)
          : ''
      if (code === 'ENOENT') {
        throw new Error(`文件不存在: ${args.path}`)
      }
      throw err
    }

    if (!fileStat.isFile()) {
      throw new Error(`不是普通文件: ${args.path}`)
    }

    if (fileStat.size > MAX_READ_BYTES) {
      throw new Error(
        `文件过大: 超过 ${MAX_READ_BYTES / 1024}KB 限制（当前 ${fileStat.size} 字节）`,
      )
    }

    const content = await readFile(filePath, 'utf-8')

    if (args.offset !== undefined || args.limit !== undefined) {
      const lines = content.split(/\r?\n/)
      if (content.endsWith('\n') || content.endsWith('\r\n')) {
        lines.pop()
      }
      const start = (args.offset ?? 1) - 1
      const end =
        args.limit !== undefined ? start + args.limit : lines.length
      const slice = lines.slice(start, end)
      const numbered = slice
        .map((line, i) => `${start + i + 1}|${line}`)
        .join('\n')
      return { data: numbered }
    }

    return { data: content }
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
