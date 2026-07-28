## ADDED Requirements

### Requirement: headless/pipe 解析 @server:uri

headless 与 pipe 模式 SHALL 在发起 `query` 前，对用户 prompt 文本解析 `@server:uri`；命中时 SHALL 将 Resource meta 消息置于用户消息之前一并送入本轮。无引用时行为与既有一致。

#### Scenario: headless prompt 含 @server:uri

- **WHEN** 用户执行 `bun run dev -- "阅读 @tour:docs://handbook 并总结"` 且 `tour` 已连接、uri 可读
- **THEN** 本轮 messages 中 Resource meta 出现在用户 prompt 之前
