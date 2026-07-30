## ADDED Requirements

### Requirement: Agent 工具注册

会话工具表 SHALL 包含 `Agent` 工具（当 subagents 能力启用时）。

#### Scenario: getTools 含 Agent

- **WHEN** 调用 `getTools()` 且 subagents 启用
- **THEN** 列表包含 `Agent`
