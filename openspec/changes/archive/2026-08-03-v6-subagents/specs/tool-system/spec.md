## ADDED Requirements

### Requirement: Agent 工具注册

会话工具表 SHALL 包含 `Agent` 工具（当 subagents 能力启用时）。顶层工具表可含 `Agent`；嵌套子代理工具表 SHALL 不含 `Agent`。

#### Scenario: getTools 含 Agent

- **WHEN** 调用顶层 `getTools()` 且 subagents 启用
- **THEN** 列表包含 `Agent`

#### Scenario: 子会话工具表无 Agent

- **WHEN** 为嵌套 Agent 运行组装工具表
- **THEN** 列表不包含 `Agent`
