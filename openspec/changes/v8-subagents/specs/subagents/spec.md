## ADDED Requirements

### Requirement: Agent 子代理工具

系统 SHALL 提供内置 `Agent` 工具，接受子任务提示并同步运行嵌套 `query()`，将子运行的最终文本摘要作为父会话的 `tool_result` 返回。子运行 SHALL 使用独立消息列表，不把子轮次全文写入父 `QueryEngine.messages`。

#### Scenario: 成功子任务回传摘要

- **WHEN** 模型调用 `Agent` 且子 query 正常完成
- **THEN** 父会话收到含摘要文本的 tool_result，父 messages 无子工具中间轨迹全文

#### Scenario: 子任务失败

- **WHEN** 子 query 以 model_error 或 abort 结束
- **THEN** 父收到 is_error 的 tool_result，父会话可继续

### Requirement: 嵌套深度限制

系统 SHALL 限制子代理嵌套深度（默认最大 1）。超过上限时 SHALL 不启动嵌套 query，直接返回错误 tool_result。

#### Scenario: 禁止孙代理

- **WHEN** 已在 depth=1 的子代理内再次调用 `Agent`
- **THEN** 返回错误，不启动更深嵌套
