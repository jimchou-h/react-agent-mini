## ADDED Requirements

### Requirement: Bash 走写权限

`Bash` SHALL 与其它非只读工具一样经过 `canUseTool`；headless 默认拒绝除非 `ALLOW_WRITE=1`。

#### Scenario: REPL 拒绝则不执行命令

- **WHEN** 模型调用 `Bash` 且用户在 REPL 确认中拒绝
- **THEN** 不启动命令进程，返回 deny 的 `tool_result`

#### Scenario: headless 默认拒绝 Bash

- **WHEN** 非 REPL 且未设置 `ALLOW_WRITE=1` 时调用 `Bash`
- **THEN** deny，不执行命令

#### Scenario: 确认摘要含命令预览

- **WHEN** REPL 对 `Bash` 请求确认
- **THEN** 提示文案包含命令的可读预览（过长可截断）
