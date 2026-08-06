/**
 * `/init` 引导 prompt（对齐 CC 精简版，无 AskUserQuestion / Ink）
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type InitTargetHint = {
  /** 仓库根（通常为 process.cwd()）探测用；测试可注入 */
  hasAgentsMd?: boolean
  hasClaudeMd?: boolean
}

/** 探测 cwd 下是否已有上下文文件 */
export function probeInitTargetHint(
  cwd: string = process.cwd(),
): InitTargetHint {
  return {
    hasAgentsMd: existsSync(join(cwd, 'AGENTS.md')),
    hasClaudeMd: existsSync(join(cwd, 'CLAUDE.md')),
  }
}

/**
 * 根据已有上下文文件选择默认写入目标：
 * - 已有 CLAUDE.md（无论是否另有 AGENTS.md）→ 改进 CLAUDE.md
 * - 否则 → 创建/更新 AGENTS.md
 */
export function resolveInitTargetFile(
  hint: InitTargetHint = {},
): 'AGENTS.md' | 'CLAUDE.md' {
  if (hint.hasClaudeMd) return 'CLAUDE.md'
  return 'AGENTS.md'
}

/** 构造注入给模型的 init 引导正文 */
export function buildInitPrompt(
  args: string = '',
  hint: InitTargetHint = {},
): string {
  const target = resolveInitTargetFile(hint)
  const extra = args.trim()
  const userNote = extra
    ? `\n\nAdditional user notes:\n${extra}\n`
    : ''

  return `Please analyze this codebase and create or update a project context file for future agent sessions.

## Target file

- Preferred file for this run: **${target}**
- Rule: if \`CLAUDE.md\` already exists, improve it; otherwise create/update \`AGENTS.md\` (default when neither exists).
- Do not invent a second parallel context file unless the user explicitly asks.
- If the target already exists, improve it — do not blindly overwrite with generic filler.

## What to add

1. Commands commonly used to build, lint, typecheck, and test (including how to run a single test when non-obvious).
2. High-level architecture that requires reading multiple files to understand — the "big picture" only.

## Usage notes

- Keep the file concise. Only include what an agent would get wrong without it.
- Do not repeat yourself. Do not include obvious instructions ("write helpful errors", "never commit secrets", etc.).
- Avoid listing every file or component that is easy to discover with Glob/Grep.
- Do not invent sections like "Tips for Development" or "Support" unless they appear in project docs you actually read.
- If README, Cursor rules (\`.cursor/rules\`, \`.cursorrules\`), or Copilot instructions exist, fold in only the important non-obvious parts.
- Prefer Edit for existing files; Write only when creating a new file. Respect permission prompts.
${userNote}
Explore with Read/Glob/Grep as needed, then write the file.`
}
