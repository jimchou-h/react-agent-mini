/**
 * `/init` 引导 prompt
 *
 * 正文对齐 Claude Code `src/commands/init.ts` 的 OLD_INIT_PROMPT
 *（NEW_INIT 依赖 AskUserQuestion / 子代理 / skills·hooks，属非目标）。
 * 仅将目标文件名按本仓库策略替换为 AGENTS.md 或 CLAUDE.md。
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type InitTargetHint = {
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
 * - 已有 CLAUDE.md → CLAUDE.md
 * - 否则 → AGENTS.md（含仅有 AGENTS.md、或两者皆无）
 */
export function resolveInitTargetFile(
  hint: InitTargetHint = {},
): 'AGENTS.md' | 'CLAUDE.md' {
  if (hint.hasClaudeMd) return 'CLAUDE.md'
  return 'AGENTS.md'
}

/**
 * CC OLD_INIT_PROMPT，仅替换目标文件名与文件头说明；可选追加用户 args。
 */
export function buildInitPrompt(
  args: string = '',
  hint: InitTargetHint = {},
): string {
  const target = resolveInitTargetFile(hint)
  const headerNote =
    target === 'CLAUDE.md'
      ? 'This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.'
      : 'This file provides guidance to coding agents when working with code in this repository.'

  // 对齐 CC OLD_INIT_PROMPT（见 claude-code src/commands/init.ts）
  let text = `Please analyze this codebase and create a ${target} file, which will be given to future instances of coding agents to operate in this repository.

What to add:
1. Commands that will be commonly used, such as how to build, lint, and run tests. Include the necessary commands to develop in this codebase, such as how to run a single test.
2. High-level code architecture and structure so that future instances can be productive more quickly. Focus on the "big picture" architecture that requires reading multiple files to understand.

Usage notes:
- If there's already a ${target}, suggest improvements to it.
- When you make the initial ${target}, do not repeat yourself and do not include obvious instructions like "Provide helpful error messages to users", "Write unit tests for all new utilities", "Never include sensitive information (API keys, tokens) in code or commits".
- Avoid listing every component or file structure that can be easily discovered.
- Don't include generic development practices.
- If there are Cursor rules (in .cursor/rules/ or .cursorrules) or Copilot rules (in .github/copilot-instructions.md), make sure to include the important parts.
- If there is a README.md, make sure to include the important parts.
- Do not make up information such as "Common Development Tasks", "Tips for Development", "Support and Documentation" unless this is expressly included in other files that you read.
- Be sure to prefix the file with the following text:

\`\`\`
# ${target}

${headerNote}
\`\`\``

  const extra = args.trim()
  if (extra) {
    text += `\n\nAdditional user notes:\n${extra}`
  }

  // mini 宿主约束（非改写 CC 正文）：REPL 下每个 Bash 都要人工确认，且拒绝会 abort 整轮。
  // 对齐纪律允许：仅补 Non-Goals / 平台差异，不重写 OLD_INIT 语义。
  text += `

## Host constraints (react-agent-mini)

- Discover build/lint/test commands by **reading** \`package.json\`, README, and CI configs — do **not** execute the full test suite or long typechecks during \`/init\`.
- Prefer a small set of reads (manifest + README + existing ${target}); avoid sweeping every CONTEXT.md.
- Write/Edit still require user confirmation; keep the ${target} concise.`

  return text
}
