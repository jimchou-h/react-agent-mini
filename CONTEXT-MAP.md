# Context Map

本仓库采用 **multi-context** 布局：每个核心模块目录下有独立的 `CONTEXT.md` 术语表，供 Agent 技能与人类贡献者统一词汇。

## 阅读顺序

1. [`docs/architecture.md`](docs/architecture.md) — 架构导读与 ReAct 流程
2. 按任务打开下方对应 `CONTEXT.md`

## 模块索引

| 路径 | 职责 | 术语表 |
|------|------|--------|
| `src/query/` | ReAct 主循环、`query()` API、依赖注入、systemPrompt | [`src/query/CONTEXT.md`](src/query/CONTEXT.md) |
| `src/skills/` | SKILL.md 发现、摘要与会话快照 | [`src/skills/CONTEXT.md`](src/skills/CONTEXT.md) |
| `src/tools/` | 内置工具（Echo、Read、Grep、Glob、Skill、Write）、`getTools()` | [`src/tools/CONTEXT.md`](src/tools/CONTEXT.md) |
| `src/permissions/` | `canUseTool` 策略（REPL y/n、headless `ALLOW_WRITE`） | [`src/permissions/CONTEXT.md`](src/permissions/CONTEXT.md) |
| `src/services/mcp/` | stdio MCP 配置、连接与工具适配 | [`src/services/mcp/CONTEXT.md`](src/services/mcp/CONTEXT.md) |
| `src/services/api/` | DeepSeek Provider、`callModel`、适配层 | [`src/services/api/CONTEXT.md`](src/services/api/CONTEXT.md) |
| `src/utils/projectContext.ts` | AGENTS.md / CLAUDE.md 发现与注入 | 见 query CONTEXT「项目上下文」 |

## 相关文档

| 文件 | 说明 |
|------|------|
| [`docs/agents/domain.md`](docs/agents/domain.md) | Agent 技能如何消费领域文档 |
| [`openspec/changes/minimal-react-agent/`](openspec/changes/minimal-react-agent/) | v0 变更提案与设计决策 |

## 约定

- 术语以各 `CONTEXT.md` 为准，issue / PR 标题尽量使用表中名称
- 新增模块时：先加 `CONTEXT.md`，再在本表登记一行
