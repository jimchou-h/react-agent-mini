import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type DiscoveredSkill = {
  name: string
  description?: string
  body: string
  path: string
}

export const MAX_SKILL_BYTES = 32 * 1024
const TRUNCATION_NOTE = '\n\n[skill truncated at 32KB]'

function truncateBody(body: string): string {
  if (Buffer.byteLength(body, 'utf-8') <= MAX_SKILL_BYTES) return body

  const available =
    MAX_SKILL_BYTES - Buffer.byteLength(TRUNCATION_NOTE, 'utf-8')
  let low = 0
  let high = body.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(body.slice(0, middle), 'utf-8') <= available) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return `${body.slice(0, low)}${TRUNCATION_NOTE}`
}

function parseSkill(
  source: string,
  path: string,
  fallbackName: string,
): DiscoveredSkill {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
  if (!match) {
    return { name: fallbackName, body: truncateBody(source), path }
  }

  const metadata = new Map<string, string>()
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    metadata.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim(),
    )
  }

  const description = metadata.get('description')
  return {
    name: metadata.get('name') || fallbackName,
    ...(description ? { description } : {}),
    body: truncateBody(match[2]!),
    path,
  }
}

async function discoverUnder(root: string): Promise<DiscoveredSkill[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const skills: DiscoveredSkill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const path = join(root, entry.name, 'SKILL.md')
    try {
      skills.push(parseSkill(await readFile(path, 'utf-8'), path, entry.name))
    } catch {
      // A skill directory without SKILL.md is not a discoverable skill.
    }
  }
  return skills
}

/** Discover workspace-local skills. */
export async function discoverSkills(
  cwd: string = process.cwd(),
): Promise<DiscoveredSkill[]> {
  const [agentSkills, claudeSkills] = await Promise.all([
    discoverUnder(join(cwd, '.agents', 'skills')),
    discoverUnder(join(cwd, '.claude', 'skills')),
  ])
  return [...agentSkills, ...claudeSkills]
}
