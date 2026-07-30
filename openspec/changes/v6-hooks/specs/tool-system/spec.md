## ADDED Requirements

### Requirement: 工具执行调用 Hooks

当 hooks 子系统启用时，串行工具执行路径 SHALL 对每个 `tool_use` 调用 PreToolUse / PostToolUse（见 `hooks` capability）。未启用时行为与既有一致。

#### Scenario: 启用时每个工具都经过 hook 点

- **WHEN** hooks 已加载且模型调用 Read
- **THEN** 执行路径包含 PreToolUse 与 PostToolUse 调用点（可为空匹配）
