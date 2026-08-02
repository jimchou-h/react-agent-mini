## ADDED Requirements

### Requirement: Agent 子代理工具

系统 SHALL 提供内置 `Agent` 工具。调用入参 SHALL 包含必填 `description`（短描述）与 `prompt`（子任务说明）；可选 `tool_names` 限制子工具白名单。系统 SHALL 同步运行嵌套 `query()`，将子运行摘要作为父会话的 `tool_result` 返回。子运行 SHALL 使用独立消息列表，不把子轮次全文写入父 `QueryEngine.messages`。

摘要 SHALL 取自子会话最后一条 assistant 消息的 text 块拼接；超长时按预算截断。失败（abort 等）SHALL 以 `is_error` 的 tool_result 回父，父会话可继续。

#### Scenario: 成功子任务回传摘要

- **WHEN** 模型调用 `Agent` 且子 query 正常完成
- **THEN** 父会话收到含摘要文本的 tool_result，父 messages 无子工具中间轨迹全文

#### Scenario: 子任务失败

- **WHEN** 子 query 以 abort 或错误终止
- **THEN** 父收到 is_error 的 tool_result，父会话可继续

#### Scenario: 入参含 description 与 prompt

- **WHEN** 模型发起合法 `Agent` tool_use
- **THEN** 入参校验要求 `description` 与 `prompt` 均为非空字符串

### Requirement: 嵌套深度与防递归

系统 SHALL 用与 Stop 相同的 `depth` 语义（`ToolUseContext.depth` / `query({ depth })`：0 = 顶层）。子代理 context 的 depth SHALL 为父 depth + 1。默认最大嵌套深度为 1。

子代理可用工具列表 SHALL **排除** `Agent`。超过 max depth 时 SHALL 不启动嵌套 query，直接返回错误 tool_result。

#### Scenario: 禁止孙代理（depth）

- **WHEN** 已在 depth=1 的子代理内再次调用 `Agent`
- **THEN** 返回错误，不启动更深嵌套

#### Scenario: 子工具池不含 Agent

- **WHEN** 组装 depth≥1 的子会话工具表
- **THEN** 列表不含名为 `Agent` 的工具

### Requirement: 子代理与 Stop

嵌套 depth ≥ 1 的 `query` SHALL NOT 执行 Stop hooks（与已归档 `v6-stop-hooks` 一致）。本能力不引入 `SubagentStop`。

#### Scenario: 子完成不跑 Stop

- **WHEN** depth≥1 的嵌套 query 正常 completed
- **THEN** 不执行 Stop hooks
