## Context

CC `/init` 是大型引导 prompt（可含 AskUserQuestion、subagent、skills/hooks）。mini 用 readline REPL，无 Ink。采用「slash → 注入系统/用户材料 → 正常 `runTurn`」精简路径。

## Goals / Non-Goals

**Goals:**

- `/init` 可发现、可调用
- 驱动模型探索仓库并写入/更新 `AGENTS.md` 和/或 `CLAUDE.md`
- 与现有 `loadProjectContext` 消费路径兼容
- 有单测覆盖 slash 解析与注入（mock callModel）

**Non-Goals:**

- Ink UI、AskUserQuestion 工具
- `/plan` / Plan Mode（v8+）
- 自动生成 skills/hooks 全套脚手架
- 个人 `CLAUDE.local.md` 复杂 worktree 逻辑（可后续）

## Decisions

1. **触发**：`/init` 为本地 slash；注入固定 init prompt（可带简短用户补充 args），再 `runTurn`。
2. **产出文件**：优先与加载约定一致——若项目已用其一则更新；皆无则默认写 `AGENTS.md`（或文档定稿「默认 CLAUDE.md」——实现前在 tasks 锁死一种，建议 **默认 `AGENTS.md`，已存在 `CLAUDE.md` 则更新之**）。
3. **权限**：写文件仍走现有 Write/Edit 确认；不绕过。
4. **已存在文件**：prompt 要求「改进而非无脑覆盖」；工具层仍是模型调用 Edit/Write。

## Risks / Trade-offs

- [模型乱写超大 md] → prompt 强调简洁、只写非显然信息
- [写权限打断] → 文档说明需确认；后续权限规则 change 可减轻

## Open Questions

无阻塞项；默认目标文件名按 Decisions #2 实现时写死并测。
