## ADDED Requirements

### Requirement: Ink 权限面板键位

Ink REPL 下，写操作（及其它需确认工具）的确认交互 SHALL 通过 Ink 权限面板完成，键位语义与既有 REPL 一致：`y` 允许一次、`n` 拒绝（deny + 对齐 `REJECT_MESSAGE` + abort 本轮）、`a` 写入会话 always-allow 规则（若 `permission-rules` 已启用）。headless / pipe 行为不变。

#### Scenario: Ink 面板允许写入

- **WHEN** Ink REPL 中模型调用 Write 且用户在权限面板按 `y`
- **THEN** 执行写入

#### Scenario: Ink 面板拒绝

- **WHEN** Ink REPL 中模型调用 Write 且用户在权限面板按 `n`
- **THEN** 返回 deny 的错误 `tool_result`，`message` 与 `REJECT_MESSAGE` 语义一致，文件不变更，并 abort 本轮 query

#### Scenario: Ink 面板始终允许

- **WHEN** Ink REPL 中模型调用 Write 且用户在权限面板按 `a`
- **THEN** 本工具（按既有规则作用域）加入会话 allow，并执行本次写入；后续同类命中可跳过确认
