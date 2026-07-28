/**
 * 会话 system prompt 组装
 *
 * 把两样东西合在一起交给模型：
 * 1. 项目说明（AGENTS.md / CLAUDE.md）
 * 2. 可用 Skill 目录（告诉模型可以用 Skill 工具加载谁）
 *
 * `loadSessionContext` 在 CLI 启动时调一次，整段会话共用这份快照。
 */

import { discoverSkills, type DiscoveredSkill } from './discover.js'
import { loadProjectContext } from '../utils/projectContext.js'

type SessionContextDeps = {
  loadProjectContext(cwd: string): Promise<string | undefined>
  discoverSkills(cwd: string): Promise<DiscoveredSkill[]>
}

/**
 * 拼 system prompt 字符串。
 * 没有 skill 时直接返回项目上下文；两边都空则 undefined。
 */
export function buildSystemPrompt(
  projectContext: string | undefined,
  skills: readonly DiscoveredSkill[],
): string | undefined {
  if (skills.length === 0) return projectContext

  const catalog = [
    '## Available Skills',
    'Use the Skill tool with a skill name to load its instructions.',
    ...skills.map(skill => {
      const label =
        skill.displayName && skill.displayName !== skill.name
          ? `${skill.name} (${skill.displayName})`
          : skill.name
      return skill.description ? `- ${label} — ${skill.description}` : `- ${label}`
    }),
  ].join('\n')

  return projectContext ? `${projectContext}\n\n${catalog}` : catalog
}

/**
 * 启动时加载「项目上下文 + skills」不可变快照。
 * deps 可注入，方便单测替换文件系统。
 */
export async function loadSessionContext(
  cwd: string = process.cwd(),
  deps: SessionContextDeps = { loadProjectContext, discoverSkills },
): Promise<{
  systemPrompt: string | undefined
  skills: readonly DiscoveredSkill[]
}> {
  const [projectContext, skills] = await Promise.all([
    deps.loadProjectContext(cwd),
    deps.discoverSkills(cwd),
  ])
  return {
    systemPrompt: buildSystemPrompt(projectContext, skills),
    skills,
  }
}
