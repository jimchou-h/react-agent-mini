/**
 * Agent Memory 加载：`.agents/memory/MEMORY.md`
 *
 * 缺失静默跳过；超预算截断。注入顺序由 systemPrompt 组装（AGENTS → Memory）。
 */

import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const MEMORY_RELATIVE_PATH = '.agents/memory/MEMORY.md'
/** Memory 正文 UTF-8 字节上限 */
export const MAX_MEMORY_BYTES = 32 * 1024
const TRUNCATION_NOTE = '\n\n[memory truncated at 32KB]'

export function memoryFilePath(cwd: string): string {
  return join(cwd, MEMORY_RELATIVE_PATH)
}

function truncateMemory(content: string): string {
  if (Buffer.byteLength(content, 'utf-8') <= MAX_MEMORY_BYTES) {
    return content
  }
  const noteBytes = Buffer.byteLength(TRUNCATION_NOTE, 'utf-8')
  const maxContentBytes = MAX_MEMORY_BYTES - noteBytes
  let truncated = content
  while (Buffer.byteLength(truncated, 'utf-8') > maxContentBytes) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated}${TRUNCATION_NOTE}`
}

/** 读取并按预算截断 Memory；缺失返回 undefined */
export async function loadAgentMemory(
  cwd: string,
): Promise<string | undefined> {
  try {
    const raw = await readFile(memoryFilePath(cwd), 'utf-8')
    return truncateMemory(raw)
  } catch {
    return undefined
  }
}

export type MemorySnapshot = {
  path: string
  content: string | undefined
  /** 文件 mtime；缺失时为 null */
  mtimeMs: number | null
}

/** 带 mtime 的快照，供轮次前刷新 */
export async function loadAgentMemorySnapshot(
  cwd: string,
): Promise<MemorySnapshot> {
  const path = memoryFilePath(cwd)
  try {
    const [raw, meta] = await Promise.all([
      readFile(path, 'utf-8'),
      stat(path),
    ])
    return {
      path,
      content: truncateMemory(raw),
      mtimeMs: meta.mtimeMs,
    }
  } catch {
    return { path, content: undefined, mtimeMs: null }
  }
}
