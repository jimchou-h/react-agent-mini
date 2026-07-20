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

对非只读工具，REPL 模式 SHALL 在执行前请求用户确认；headless/pipe 默认拒绝，除非环境变量 `ALLOW_WRITE=1`。

#### Scenario: REPL 用户确认后写入

- **WHEN** 模型调用 Write 且用户在提示中输入 `y`
- **THEN** 执行写入

#### Scenario: REPL 用户拒绝

- **WHEN** 模型调用 Write 且用户输入 `n`
- **THEN** 返回 deny 的错误 `tool_result`，文件不变更，并 abort 本轮 query（不再回调模型）

#### Scenario: headless 默认拒绝 Write

- **WHEN** 在非 REPL 模式且未设置 `ALLOW_WRITE=1` 时调用 Write
- **THEN** 返回 deny，不写入
