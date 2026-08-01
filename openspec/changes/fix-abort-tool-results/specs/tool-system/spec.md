## ADDED Requirements

### Requirement: Abort 时补齐未执行工具的 tool_result

当同轮串行执行因 `abortController` 中止而跳过后续 `tool_use` 时，系统 SHALL 仍为每个未执行的 `tool_use` 产出 `is_error` 的合成 `tool_result`（标明因前序拒绝或本轮中止而跳过），SHALL NOT 调用对应工具的 `call` 或 hooks。已执行（含 deny）的工具保持其既有 `tool_result`。

#### Scenario: 中途 abort 后后续工具仍有 result

- **WHEN** 同一 assistant 消息含多个 `tool_use`（如 Read、Write、Read），且执行到 Write 时权限拒绝并 abort
- **THEN** Write 有 deny 的 `tool_result`；其后未执行的 Read 亦有合成错误 `tool_result`；会话中每个 `tool_use.id` 均有对应 `tool_result`

#### Scenario: 合成 result 不执行业务

- **WHEN** 因 abort 为某 `tool_use` 生成合成 `tool_result`
- **THEN** 不调用该工具的 `call`，也不运行其 PreToolUse / PostToolUse hooks
