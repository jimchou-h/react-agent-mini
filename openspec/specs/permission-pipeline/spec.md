# permission-pipeline Specification

## Purpose

可注入的 `canUseTool` 权限决策：未注入时默认 auto-allow；REPL 对写操作交互确认；headless/pipe 默认拒绝写操作（可用 `ALLOW_WRITE=1` 放行）。
## Requirements
### Requirement: 可注入 canUseTool

系统 SHALL 通过 `ToolUseContext`（或等价注入点）支持自定义 `canUseTool`；未提供时默认 auto-allow。

#### Scenario: 默认 auto-allow 只读

- **WHEN** 未注入自定义 `canUseTool` 且模型调用 Read
- **THEN** 工具立即执行（与 v1 一致）

#### Scenario: deny 返回错误 tool_result

- **WHEN** `canUseTool` 返回 `{ behavior: 'deny', message }`
- **THEN** `runToolUse` 不调用 `tool.call()`，并返回 `is_error` 的 `tool_result`

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

### Requirement: Edit 走写权限

`Edit` SHALL 与其它非只读工具一样经过 `canUseTool`；headless 默认拒绝除非 `ALLOW_WRITE=1`。

#### Scenario: REPL 拒绝则不修改文件

- **WHEN** 模型调用 `Edit` 且用户在 REPL 确认中拒绝
- **THEN** 文件内容不变，返回 deny 的 `tool_result`

#### Scenario: headless 默认拒绝 Edit

- **WHEN** 非 REPL 且未设置 `ALLOW_WRITE=1` 时调用 `Edit`
- **THEN** deny，文件不变

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

### Requirement: 规则层接入 canUseTool

权限回调 SHALL 在询问用户前检查会话规则；headless 默认策略不变，除非规则或既有 env 放行。

#### Scenario: headless 无规则仍 deny 写

- **WHEN** headless 调用 Write 且无放行规则/env
- **THEN** deny

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

