## MODIFIED Requirements

### Requirement: 写操作需确认或显式允许

对非只读工具，REPL 模式 SHALL 在执行前请求用户确认；headless/pipe 默认拒绝，除非环境变量 `ALLOW_WRITE=1`。用户拒绝时返回给模型的 `message` SHALL 对齐 claude-code `REJECT_MESSAGE` 英文语义。

#### Scenario: REPL 用户确认后写入

- **WHEN** 模型调用 Write 且用户在提示中输入 `y`
- **THEN** 执行写入

#### Scenario: REPL 用户拒绝

- **WHEN** 模型调用 Write 且用户输入 `n`
- **THEN** 返回 deny 的错误 `tool_result`，`message` 为英文拒绝说明（与 `REJECT_MESSAGE` 语义一致），文件不变更，并 abort 本轮 query（不再回调模型）

#### Scenario: headless 默认拒绝 Write

- **WHEN** 在非 REPL 模式且未设置 `ALLOW_WRITE=1` 时调用 Write
- **THEN** 返回 deny，不写入
