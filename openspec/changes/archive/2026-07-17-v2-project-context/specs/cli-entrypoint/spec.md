## ADDED Requirements

### Requirement: 启动时加载项目上下文

CLI（含 REPL 与 headless）SHALL 在启动 Agent 会话前尝试加载项目上下文，并传入 `QueryEngine` / `query`。

#### Scenario: REPL 带上下文启动

- **WHEN** 用户在含 `AGENTS.md` 的目录执行 `bun run dev`
- **THEN** REPL 会话的模型请求包含该文件内容作为 system prompt
