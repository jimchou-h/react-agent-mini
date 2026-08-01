## ADDED Requirements

### Requirement: abort 终止后历史仍配对

当 `query` 因工具权限 abort 等原因返回 `{ reason: 'aborted' }` 时，本轮已 yield 进会话的消息 SHALL 仍满足：assistant 中每个 `tool_use` 在后续 user `tool_result` 中有对应 `tool_use_id`（含因跳过而合成的错误 result）。SHALL NOT 在缺少配对的情况下结束本轮并把孤儿 `tool_use` 留给下一轮 `callModel`。

#### Scenario: aborted 后下一轮可继续会话

- **WHEN** 用户拒绝写工具导致本轮 `aborted`，且同批尚有未执行的只读 `tool_use`
- **THEN** 那些未执行工具已有合成 `tool_result` 写入流/历史；用户再发下一条消息时，历史无孤儿 `tool_use`
