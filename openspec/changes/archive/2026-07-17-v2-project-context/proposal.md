## Why

v1 Agent 没有项目级系统上下文，模型不知道仓库约定（AGENTS.md / CLAUDE.md）。Skills 与后续 MCP 都依赖「把外部知识注入会话」这条能力；先打通 project context，扩展柱才有底座。

## What Changes

- 启动时发现并加载 `AGENTS.md` / `CLAUDE.md`（cwd 及向上查找，取最近一份或合并策略见 design）
- 将项目上下文作为 **system prompt**（或等价首条 system 消息）传入 `callModel`
- 扩展 `CallModelParams` / `QueryParams` 支持可选 `systemPrompt`
- CLI / REPL / QueryEngine 接线加载逻辑
- 更新 architecture 与 CONTEXT 文档

## Capabilities

### New Capabilities

- `project-context`：发现、加载、注入项目级 Markdown 上下文到模型调用

### Modified Capabilities

- `deepseek-provider`：`callModel` / adapter 支持 system 消息
- `react-loop`：`query()` 透传 `systemPrompt`
- `cli-entrypoint`：启动时加载并传入上下文（含 REPL）

## Impact

- **新增**：`src/utils/projectContext.ts`（或 `src/context.ts`）
- **修改**：`query/types.ts`、`query.ts`、`adapter.ts`、`client.ts`、`QueryEngine.ts`、`cli.ts` / `repl.ts`
- **不影响**：工具执行流水线、权限策略
- **后续**：`v2-skills` 依赖本 change 的注入通道
