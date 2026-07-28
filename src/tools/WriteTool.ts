/**
 * Write 工具：覆盖写入 cwd 内文件
 *
 * 入参 `file_path`；父目录不存在会自动 mkdir；内容 ≤100KB；非只读。
 */

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { resolvePathUnderCwd } from './ReadTool.js'

/** Write 工具单次内容大小上限（100KB） */
export const MAX_WRITE_BYTES = 100 * 1024

const writeInputSchema = z.object({
  file_path: z.string().describe('要写入的文件路径（相对 cwd 或绝对路径）'),
  content: z.string().describe('要写入的 UTF-8 文本内容'),
})

/**
 * Write 工具 — 覆盖写入 cwd 内文件
 *
 * 约束：路径在 cwd 子树、自动创建父目录、内容 ≤100KB、非只读。
 */
export const WriteTool: Tool<typeof writeInputSchema> = {
  name: 'Write',
  description:
    '将文本内容写入本地文件（UTF-8，覆盖写）。路径必须在当前工作目录内',
  inputSchema: writeInputSchema,

  async call(args) {
    const byteLength = Buffer.byteLength(args.content, 'utf-8')
    if (byteLength > MAX_WRITE_BYTES) {
      throw new Error(
        `内容过大: 超过 ${MAX_WRITE_BYTES / 1024}KB 限制（当前 ${byteLength} 字节）`,
      )
    }

    const filePath = resolvePathUnderCwd(args.file_path)
    const displayPath = args.file_path

    let existed = false
    try {
      await stat(filePath)
      existed = true
    } catch {
      existed = false
    }

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, args.content, 'utf-8')

    return {
      data: existed
        ? `File at ${displayPath} has been updated successfully.`
        : `File created successfully at: ${displayPath}`,
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
