/**
 * 会话 system prompt 组装
 *
 * 把这些合在一起交给模型：
 * 1. 项目说明（AGENTS.md / CLAUDE.md）
 * 2. Agent Memory 指引（始终含路径；有正文则附上）— 对齐 CC loadMemoryPrompt 精简版
 * 3. 可用 Skill 目录
 *
 * `loadSessionContext` 在 CLI 启动时调一次；Memory 可在轮次前按 mtime 刷新。
 */

import { discoverSkills, type DiscoveredSkill } from './discover.js'
import {
  ensureMemoryDirExists,
  formatMemoryPromptSection,
  loadAgentMemory,
  loadAgentMemorySnapshot,
  type MemorySnapshot,
} from '../services/memory/load.js'
import { loadProjectContext } from '../utils/projectContext.js'

type SessionContextDeps = {
  loadProjectContext(cwd: string): Promise<string | undefined>
  discoverSkills(cwd: string): Promise<DiscoveredSkill[]>
  loadAgentMemory?(cwd: string): Promise<string | undefined>
  loadAgentMemorySnapshot?(cwd: string): Promise<MemorySnapshot>
  ensureMemoryDirExists?(cwd: string): Promise<void>
}

/**
 * 拼 system prompt。
 * 顺序：project → memory 段（始终）→ skills。
 * @param cwd 用于拼 Memory 绝对/工作区路径；缺省 `process.cwd()`
 */
export function buildSystemPrompt(
  projectContext: string | undefined,
  skills: readonly DiscoveredSkill[],
  memory?: string | undefined,
  cwd: string = process.cwd(),
): string | undefined {
  const parts: string[] = []
  if (projectContext) parts.push(projectContext)
  parts.push(formatMemoryPromptSection(cwd, memory))

  if (skills.length > 0) {
    const catalog = [
      '## Available Skills',
      'Use the Skill tool with a skill name to load its instructions.',
      ...skills.map(skill => {
        const label =
          skill.displayName && skill.displayName !== skill.name
            ? `${skill.name} (${skill.displayName})`
            : skill.name
        return skill.description
          ? `- ${label} — ${skill.description}`
          : `- ${label}`
      }),
    ].join('\n')
    parts.push(catalog)
  }

  if (parts.length === 0) return undefined
  return parts.join('\n\n')
}

/**
 * 启动时加载「项目上下文 + memory + skills」快照，并 ensure memory 目录。
 */
export async function loadSessionContext(
  cwd: string = process.cwd(),
  deps: SessionContextDeps = {
    loadProjectContext,
    discoverSkills,
    loadAgentMemory,
    loadAgentMemorySnapshot,
    ensureMemoryDirExists,
  },
): Promise<{
  systemPrompt: string | undefined
  skills: readonly DiscoveredSkill[]
  memory: string | undefined
  projectContext: string | undefined
  memorySnapshot: MemorySnapshot
}> {
  const ensureDir = deps.ensureMemoryDirExists ?? ensureMemoryDirExists
  await ensureDir(cwd)

  const loadSnap =
    deps.loadAgentMemorySnapshot ??
    (async (dir: string) => {
      const content = deps.loadAgentMemory
        ? await deps.loadAgentMemory(dir)
        : await loadAgentMemory(dir)
      return {
        path: memoryFilePathFallback(dir),
        content,
        mtimeMs: content === undefined ? null : 0,
      }
    })

  const [projectContext, skills, memorySnapshot] = await Promise.all([
    deps.loadProjectContext(cwd),
    deps.discoverSkills(cwd),
    loadSnap(cwd),
  ])
  return {
    systemPrompt: buildSystemPrompt(
      projectContext,
      skills,
      memorySnapshot.content,
      cwd,
    ),
    skills,
    memory: memorySnapshot.content,
    projectContext,
    memorySnapshot,
  }
}

function memoryFilePathFallback(dir: string): string {
  return `${dir.replace(/[/\\]+$/, '')}/.agents/memory/MEMORY.md`
}
