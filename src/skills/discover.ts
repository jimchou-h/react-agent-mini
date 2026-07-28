/**
 * Skill 发现：扫描工作区里的 SKILL.md，变成可调用列表
 *
 * 扫描目录：
 * - `.agents/skills/<目录名>/SKILL.md`
 * - `.claude/skills/<目录名>/SKILL.md`
 *
 * 调用 ID = 目录名（不是 frontmatter 的 name）；frontmatter `name` 只当展示名。
 * 正文超过 32KB 会截断，避免撑爆上下文。
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type DiscoveredSkill = {
  /** 调用 ID（目录名），Skill 工具入参用这个 */
  name: string
  /** frontmatter name，仅用于展示 */
  displayName?: string
  description?: string
  /** SKILL.md 正文（可能已截断） */
  body: string
  /** SKILL.md 绝对路径 */
  path: string
}

/** 单个 SKILL.md 正文 UTF-8 字节上限（超限截断并附说明） */
export const MAX_SKILL_BYTES = 32 * 1024
const TRUNCATION_NOTE = '\n\n[skill truncated at 32KB]'

/**
 * 按 UTF-8 字节截断正文；二分找最大安全 slice，避免按码点截断半个多字节字符。
 */
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

/**
 * 解析单个 SKILL.md：frontmatter + 正文。
 * 无 frontmatter 时整文件当正文；`name` 字段只写入 displayName。
 */
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
  const displayName = metadata.get('name')
  return {
    name: fallbackName,
    ...(displayName ? { displayName } : {}),
    ...(description ? { description } : {}),
    body: truncateBody(match[2]!),
    path,
  }
}

/** 扫描某个 skills 根目录下的一级子目录 */
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
      // 目录存在但没有 SKILL.md → 不算可发现 skill
    }
  }
  return skills
}

/**
 * 发现当前工作区全部本地 Skill（`.agents` + `.claude` 两处合并）。
 * 目录都不存在时返回空数组，不抛错。
 */
export async function discoverSkills(
  cwd: string = process.cwd(),
): Promise<DiscoveredSkill[]> {
  const [agentSkills, claudeSkills] = await Promise.all([
    discoverUnder(join(cwd, '.agents', 'skills')),
    discoverUnder(join(cwd, '.claude', 'skills')),
  ])
  return [...agentSkills, ...claudeSkills]
}
