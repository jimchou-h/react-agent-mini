/**
 * Agent Memory：路径约定、加载截断、mtime 刷新、system prompt 指引
 *
 * 对齐 claude-code memdir 精简子集：
 * - 始终注入路径 + remember 写法（不只在有正文时）
 * - 启动时 ensure 目录，便于 Write 直接落盘
 *
 * 不负责：topic 文件双步 index、session memory compact、云端 store。
 */

import { mkdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const MEMORY_RELATIVE_PATH = '.agents/memory/MEMORY.md'
/** Memory 正文 UTF-8 字节上限 */
export const MAX_MEMORY_BYTES = 32 * 1024
const TRUNCATION_NOTE = '\n\n[memory truncated at 32KB]'

/** 对齐 CC DIR_EXISTS_GUIDANCE 的精简版 */
export const MEMORY_DIR_EXISTS_GUIDANCE =
  'This directory already exists — write to it directly with the Write tool (do not run mkdir or check for its existence).'

export function memoryFilePath(cwd: string): string {
  return join(cwd, MEMORY_RELATIVE_PATH)
}

export function memoryDirPath(cwd: string): string {
  return dirname(memoryFilePath(cwd))
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

/**
 * 拼进 system prompt 的 Memory 段（始终包含路径与 remember 指引）。
 * 对齐 CC `buildMemoryLines` + 空 `MEMORY.md` 提示的精简版。
 */
export function formatMemoryPromptSection(
  cwd: string,
  memoryContent?: string | undefined,
): string {
  const file = memoryFilePath(cwd)
  const lines = [
    '## Agent Memory',
    '',
    `You have a persistent, file-based memory at \`${MEMORY_RELATIVE_PATH}\` (resolved: \`${file}\`). ${MEMORY_DIR_EXISTS_GUIDANCE}`,
    '',
    'If the user explicitly asks you to remember something, save it immediately by creating or updating that `MEMORY.md` with the Write or Edit tool. Do not invent other note paths (for example `docs/notes/`) for cross-session memory.',
    'If they ask you to forget something, remove the relevant text from that file.',
    '',
    '## MEMORY.md',
    '',
  ]
  if (memoryContent?.trim()) {
    lines.push(memoryContent.trimEnd())
  } else {
    lines.push(
      'Your MEMORY.md is currently empty. When you save new memories, they will appear here.',
    )
  }
  return lines.join('\n')
}

/** 保证 `.agents/memory/` 存在，便于模型直接 Write（对齐 CC ensureMemoryDirExists） */
export async function ensureMemoryDirExists(cwd: string): Promise<void> {
  try {
    await mkdir(memoryDirPath(cwd), { recursive: true })
  } catch {
    // fail-soft：prompt 仍注入；Write 时再暴露真实错误
  }
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

/**
 * 若 mtime 未变则复用 previous；否则重读。
 * previous 为 undefined 时等价于首次 load。
 */
export async function refreshMemorySnapshot(
  cwd: string,
  previous: MemorySnapshot | undefined,
): Promise<{ snapshot: MemorySnapshot; changed: boolean }> {
  if (!previous) {
    const snapshot = await loadAgentMemorySnapshot(cwd)
    return { snapshot, changed: true }
  }
  const path = memoryFilePath(cwd)
  try {
    const meta = await stat(path)
    if (previous.mtimeMs !== null && meta.mtimeMs === previous.mtimeMs) {
      return { snapshot: previous, changed: false }
    }
    const raw = await readFile(path, 'utf-8')
    return {
      snapshot: {
        path,
        content: truncateMemory(raw),
        mtimeMs: meta.mtimeMs,
      },
      changed: true,
    }
  } catch {
    const missing: MemorySnapshot = {
      path,
      content: undefined,
      mtimeMs: null,
    }
    const changed =
      previous.content !== undefined || previous.mtimeMs !== null
    return { snapshot: missing, changed }
  }
}
