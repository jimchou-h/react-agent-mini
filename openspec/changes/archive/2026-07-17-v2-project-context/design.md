## Context

当前 `callModel` 只发送 conversation `messages`，无 system prompt。claude-code 通过 `context.ts` / `claudemd.ts` 加载项目说明。v2 做最小子集：发现 Markdown → 注入 system。

## Goals / Non-Goals

**Goals:**

- 发现并加载项目上下文文件
- 经 `systemPrompt` 传到 Provider（OpenAI `role: system`）
- REPL / headless / pipe 均生效
- 文件缺失时静默跳过（不报错退出）

**Non-Goals:**

- 多级合并全部 CLAUDE.md 树（可只取 cwd 最近一份，或 cwd + 向上一层）
- Memory 文件、日期、git status 等完整 context 管道
- compact / token budget

## Decisions

### 1. 发现顺序

**选择**：自 `cwd` 向上查找，优先使用找到的第一份：

1. `AGENTS.md`
2. `CLAUDE.md`

若同目录两者都有，**合并**：`AGENTS.md` 在前，`CLAUDE.md` 在后（中间分隔线）。

**理由**：本仓库已有 AGENTS.md 惯例；兼容 Claude 生态。

### 2. 注入方式

**选择**：`CallModelParams.systemPrompt?: string`；`adapter` 在 messages 数组最前插入 `{ role: 'system', content }`。

**理由**：不污染对话 `messages[]` 历史；`/clear` 不清 system。

### 3. 大小上限

**选择**：单文件 / 合并后最多 64KB；超出截断并在末尾注明。

### 4. QueryEngine

**选择**：构造时传入 `systemPrompt`，每次 `runTurn` → `query` → `callModel` 透传。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 过大 md 占满 context | 64KB 上限 |
| 路径爬升到用户家目录 | 最多向上 N=5 层或停在 git root |

## Migration Plan

无破坏性变更。无上下文文件时行为与 v1 一致。

## Open Questions

- （已关闭）文件优先级 → AGENTS.md 优先，同目录可合并
- MCP：不在本 change；见 v2-skills design「后续」
