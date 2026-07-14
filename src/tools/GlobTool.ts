import { Glob } from 'bun'
import { z } from 'zod'
import type { Tool } from '../Tool.js'
import { resolvePathUnderCwd } from './ReadTool.js'

/** Glob 最多返回的文件路径数 */
export const MAX_GLOB_RESULTS = 100

const globInputSchema = z.object({
  pattern: z.string().describe('glob 模式（如 **/*.ts）'),
  path: z.string().optional().describe('搜索根目录（相对 cwd，默认 cwd）'),
})

/**
 * Glob 工具 — 在 cwd 子树内按 glob 模式列举文件路径
 *
 * 使用 Bun 内置 Glob API；结果上限 100 条。
 */
export const GlobTool: Tool<typeof globInputSchema> = {
  name: 'Glob',
  description: '按 glob 模式列举当前工作目录内的文件路径',
  inputSchema: globInputSchema,

  async call(args) {
    const root = resolvePathUnderCwd(args.path ?? '.')
    const glob = new Glob(args.pattern)
    const matches: string[] = []
    let truncated = false

    for await (const match of glob.scan({
      cwd: root,
      onlyFiles: true,
      dot: false,
    })) {
      if (matches.length >= MAX_GLOB_RESULTS) {
        truncated = true
        break
      }
      const normalized = match.replace(/\\/g, '/')
      const display =
        args.path && args.path !== '.'
          ? `${args.path.replace(/\\/g, '/').replace(/\/$/, '')}/${normalized}`
          : normalized
      matches.push(display)
    }

    let output = matches.join('\n')
    if (truncated) {
      output += `\n…（已截断，最多 ${MAX_GLOB_RESULTS} 条）`
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
