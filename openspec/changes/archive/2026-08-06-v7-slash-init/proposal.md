## Why

Claude Code 的 `/init` 是高频入口：分析仓库并生成项目说明文件，降低后续会话冷启动成本。mini 已能加载 `AGENTS.md` / `CLAUDE.md`，但缺少一键引导生成/更新的 slash。对齐 CC 精简版 `/init`，不做 Ink、不做全量访谈 UI。

## What Changes

- 新增 REPL slash：`/init`
- 触发一轮（或固定注入）引导：探索代码库并用 Write/Edit 创建或更新项目上下文文件
- 目标文件策略与现有加载逻辑一致（`AGENTS.md` / `CLAUDE.md`）
- `/help` 列出该命令；文档说明非目标

## Capabilities

### New Capabilities

- `slash-init`: `/init` 行为与生成项目上下文的契约

### Modified Capabilities

- `repl-session`: 注册 `/init` slash
- `project-context`: 与生成/更新上下文文件的关系（若需求层有增）

## Impact

- `entrypoints/repl.ts` 及 slash 解析/会话处理
- 依赖现有 Read/Glob/Grep/Write/Edit 与权限确认
- **不做**：`/plan`、Plan Mode、Ink、AskUserQuestion 多阶段访谈、自动 skills/hooks 脚手架（留给 v8+）
