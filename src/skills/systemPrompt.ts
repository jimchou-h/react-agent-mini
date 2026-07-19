import { discoverSkills, type DiscoveredSkill } from './discover.js'
import { loadProjectContext } from '../utils/projectContext.js'

type SessionContextDeps = {
  loadProjectContext(cwd: string): Promise<string | undefined>
  discoverSkills(cwd: string): Promise<DiscoveredSkill[]>
}

/** Merge project instructions with a discoverable Skill catalog. */
export function buildSystemPrompt(
  projectContext: string | undefined,
  skills: readonly DiscoveredSkill[],
): string | undefined {
  if (skills.length === 0) return projectContext

  const catalog = [
    '## Available Skills',
    'Use the Skill tool with a skill name to load its instructions.',
    ...skills.map(skill =>
      skill.description
        ? `- ${skill.name} — ${skill.description}`
        : `- ${skill.name}`,
    ),
  ].join('\n')

  return projectContext ? `${projectContext}\n\n${catalog}` : catalog
}

/** Load one immutable project/skills snapshot for a CLI session. */
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
