/**
 * 会话 system prompt 组装
 *
 * 把这些合在一起交给模型：
 * 1. 项目说明（AGENTS.md / CLAUDE.md）
 * 2. Agent Memory（`.agents/memory/MEMORY.md`）
 * 3. 可用 Skill 目录（告诉模型可以用 Skill 工具加载谁）
 *
 * `loadSessionContext` 在 CLI 启动时调一次；Memory 可在轮次前按 mtime 刷新。
 */

import { discoverSkills, type DiscoveredSkill } from './discover.js'
import {
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
}

/**
 * 拼 system prompt 字符串。
 * 顺序：project → memory → skills。全空则 undefined。
 */
export function buildSystemPrompt(
  projectContext: string | undefined,
  skills: readonly DiscoveredSkill[],
  memory?: string | undefined,
): string | undefined {
  const parts: string[] = []
  if (projectContext) parts.push(projectContext)
  if (memory) parts.push(memory)

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
 * 启动时加载「项目上下文 + memory + skills」快照。
 * deps 可注入，方便单测替换文件系统。
 */
export async function loadSessionContext(
  cwd: string = process.cwd(),
  deps: SessionContextDeps = {
    loadProjectContext,
    discoverSkills,
    loadAgentMemory,
    loadAgentMemorySnapshot,
  },
): Promise<{
  systemPrompt: string | undefined
  skills: readonly DiscoveredSkill[]
  memory: string | undefined
  projectContext: string | undefined
  memorySnapshot: MemorySnapshot
}> {
  const loadSnap =
    deps.loadAgentMemorySnapshot ??
    (async (dir: string) => {
      const content = deps.loadAgentMemory
        ? await deps.loadAgentMemory(dir)
        : await loadAgentMemory(dir)
      return {
        path: `${dir}/.agents/memory/MEMORY.md`,
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
    ),
    skills,
    memory: memorySnapshot.content,
    projectContext,
    memorySnapshot,
  }
}
