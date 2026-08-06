/**
 * Read 工具：读 cwd 内文本文件（带行号）
 *
 * 入参用 `file_path`（对齐 Claude Code）。
 * 路径必须落在当前工作目录内；单文件 ≤100KB；整文件/分段读取都会带 `行号\t内容`。
 * 同路径+同 range 且 mtime 未变时返回 stub（对齐 CC FileReadTool readFileState dedup）。
 */

import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'
import type { Tool, ToolUseContext } from '../Tool.js'

/** Read 工具单文件大小上限（100KB） */
export const MAX_READ_BYTES = 100 * 1024

/**
 * 对齐 CC `FILE_UNCHANGED_STUB`（packages/builtin-tools/.../FileReadTool/prompt.ts）
 */
export const FILE_UNCHANGED_STUB =
  'File unchanged since last read. The content from the earlier Read tool_result in this conversation is still current — refer to that instead of re-reading.'

const readInputSchema = z.object({
  file_path: z.string().describe('要读取的文件路径（相对 cwd 或绝对路径）'),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('起始行号（1-based，0 视为 1），与 limit 一起分段读取'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('读取行数，与 offset 一起分段读取'),
})

/** 按行切开；文件以换行结束时去掉 split 产生的空尾项 */
function splitLines(content: string): string[] {
  const lines = content.split(/\r?\n/)
  if (content.endsWith('\n') || content.endsWith('\r\n')) {
    lines.pop()
  }
  return lines
}

/** offset：未传从第 1 行；传 0 也视为第 1 行（对齐 Claude Code） */
function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined) {
    return 1
  }
  return offset === 0 ? 1 : offset
}

function formatNumberedLines(lines: string[], startLine: number): string {
  return lines.map((line, i) => `${startLine + i}\t${line}`).join('\n')
}

/**
 * 把用户路径解析成绝对路径，并校验必须在 cwd 子树内。
 * 防止 `../../etc/passwd` 一类路径穿越。
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

/** Read 工具 — 读取 cwd 内普通文件的 UTF-8 文本（带行号前缀） */
export const ReadTool: Tool<typeof readInputSchema> = {
  name: 'Read',
  description: '读取本地文本文件内容（UTF-8），路径必须在当前工作目录内',
  inputSchema: readInputSchema,

  async call(args, context: ToolUseContext) {
    const filePath = resolvePathUnderCwd(args.file_path)
    const readFileState = context.readFileState

    let fileStat
    try {
      fileStat = await stat(filePath)
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as NodeJS.ErrnoException).code)
          : ''
      if (code === 'ENOENT') {
        throw new Error(`文件不存在: ${args.file_path}`)
      }
      throw err
    }

    if (!fileStat.isFile()) {
      throw new Error(`不是普通文件: ${args.file_path}`)
    }

    if (fileStat.size > MAX_READ_BYTES) {
      throw new Error(
        `文件过大: 超过 ${MAX_READ_BYTES / 1024}KB 限制（当前 ${fileStat.size} 字节）`,
      )
    }

    // 对齐 CC：仅对先前 Read 写入的条目去重（fromRead）；mtime 未变且 range 相同 → stub
    const existing = readFileState?.get(filePath)
    if (existing?.fromRead) {
      const rangeMatch =
        existing.offset === args.offset && existing.limit === args.limit
      if (
        rangeMatch &&
        Math.floor(fileStat.mtimeMs) === existing.timestamp
      ) {
        return { data: FILE_UNCHANGED_STUB }
      }
    }

    const content = await readFile(filePath, 'utf-8')
    const lines = splitLines(content)
    const startLine = normalizeOffset(args.offset)

    let data: string
    if (args.offset !== undefined || args.limit !== undefined) {
      const start = startLine - 1
      const end =
        args.limit !== undefined ? start + args.limit : lines.length
      const slice = lines.slice(start, end)
      data = formatNumberedLines(slice, startLine)
    } else {
      data = formatNumberedLines(lines, 1)
    }

    readFileState?.set(filePath, {
      timestamp: Math.floor(fileStat.mtimeMs),
      offset: args.offset,
      limit: args.limit,
      fromRead: true,
    })

    return { data }
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
