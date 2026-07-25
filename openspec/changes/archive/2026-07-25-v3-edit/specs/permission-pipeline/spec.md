## ADDED Requirements

### Requirement: Edit 走写权限

`Edit` SHALL 与其它非只读工具一样经过 `canUseTool`；headless 默认拒绝除非 `ALLOW_WRITE=1`。

#### Scenario: REPL 拒绝则不修改文件

- **WHEN** 模型调用 `Edit` 且用户在 REPL 确认中拒绝
- **THEN** 文件内容不变，返回 deny 的 `tool_result`

#### Scenario: headless 默认拒绝 Edit

- **WHEN** 非 REPL 且未设置 `ALLOW_WRITE=1` 时调用 `Edit`
- **THEN** deny，文件不变
