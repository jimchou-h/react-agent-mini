import { readFile, stat, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { resolvePathUnderCwd } from './ReadTool.js'

/** Edit 工具单文件大小上限（100KB），与 Read/Write 对称 */
export const MAX_EDIT_BYTES = 100 * 1024

const editInputSchema = z.object({
  path: z.string().describe('要编辑的文件路径（相对 cwd 或绝对路径）'),
  old_string: z.string().describe('要被替换的原文（默认须唯一匹配）'),
  new_string: z.string().describe('替换后的文本'),
  replace_all: z
    .boolean()
    .optional()
    .describe('为 true 时替换全部匹配；默认仅允许唯一匹配'),
})

/**
 * Edit 工具 — 在 cwd 内已存在文件中做精确字符串替换
 *
 * 默认 `old_string` 必须恰好出现一次；`replace_all` 可替换全部。
 * 文件须已存在且 ≤100KB；非只读，走 canUseTool。
 */
export const EditTool: Tool<typeof editInputSchema> = {
  name: 'Edit',
  description:
    '在已存在的本地文件中把 old_string 替换为 new_string。默认须唯一匹配；路径须在当前工作目录内',
  inputSchema: editInputSchema,

  async call(args) {
    if (args.old_string === args.new_string) {
      throw new Error('old_string 与 new_string 相同，无需编辑')
    }

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

    if (fileStat.size > MAX_EDIT_BYTES) {
      throw new Error(
        `文件过大: 超过 ${MAX_EDIT_BYTES / 1024}KB 限制（当前 ${fileStat.size} 字节）`,
      )
    }

    const original = await readFile(filePath, 'utf-8')
    const count = countOccurrences(original, args.old_string)

    if (count === 0) {
      throw new Error(
        `未找到 old_string（请检查原文是否完全匹配，含换行与空白）`,
      )
    }

    if (!args.replace_all && count > 1) {
      throw new Error(
        `old_string 出现 ${count} 次（多次匹配）。请扩大上下文使匹配唯一，或设置 replace_all: true`,
      )
    }

    const next = args.replace_all
      ? original.split(args.old_string).join(args.new_string)
      : original.replace(args.old_string, args.new_string)

    await writeFile(filePath, next, 'utf-8')

    const replaced = args.replace_all ? count : 1
    return {
      data: `已编辑 ${args.path}（替换 ${replaced} 处）`,
    }
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

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) {
    throw new Error('old_string 不能为空')
  }
  let count = 0
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count++
    from = idx + needle.length
  }
  return count
}
