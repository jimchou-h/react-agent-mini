## ADDED Requirements

### Requirement: systemPrompt 参数

`callModel` SHALL 接受可选 `systemPrompt`；非空时转换为 OpenAI system 消息置于 messages 最前。

#### Scenario: 无 systemPrompt

- **WHEN** 未传入 `systemPrompt` 或为空字符串
- **THEN** 出站 messages 不含额外 system 消息（与 v1 行为一致）

## MODIFIED Requirements

### Requirement: 消息格式双向适配

系统 SHALL 在内部使用 Anthropic 形态消息（含 `tool_use` / `tool_result` 内容块），在 API 边界转换为 OpenAI Chat Completions 格式（`tool_calls` / `role: tool`）。

#### Scenario: 出站转换

- **WHEN** `callModel` 发送含历史 `tool_result` 的消息列表
- **THEN** 适配层将其转为 OpenAI `messages` 数组及 `tools` 定义

#### Scenario: 入站转换

- **WHEN** DeepSeek 响应含 `tool_calls`
- **THEN** 适配层将其转为内部 `tool_use` 内容块供 `query` 循环消费

#### Scenario: system 消息出站

- **WHEN** `callModel` 收到非空 `systemPrompt`
- **THEN** 适配后的 OpenAI messages 以 system 角色消息开头
