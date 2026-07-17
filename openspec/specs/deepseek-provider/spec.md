# deepseek-provider Specification

## Purpose

通过 OpenAI 兼容 SDK 连接 DeepSeek，并在 Anthropic 形态消息与 Chat Completions 格式之间双向适配（含流式解析与 tools schema）。

## Requirements

### Requirement: DeepSeek API 连接

系统 SHALL 通过 OpenAI SDK 连接 DeepSeek，使用环境变量 `OPENAI_API_KEY`、`OPENAI_BASE_URL`（默认 `https://api.deepseek.com`）、`OPENAI_MODEL`（默认 `deepseek-chat`）。

#### Scenario: 缺少 API Key

- **WHEN** `OPENAI_API_KEY` 未设置且发起模型调用
- **THEN** 系统抛出可读错误，提示配置 API Key

#### Scenario: 成功连接

- **WHEN** 环境变量正确配置且网络可达
- **THEN** 系统可向 DeepSeek 发起 chat completions 请求

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

### Requirement: systemPrompt 参数

`callModel` SHALL 接受可选 `systemPrompt`；非空时转换为 OpenAI system 消息置于 messages 最前。

#### Scenario: 无 systemPrompt

- **WHEN** 未传入 `systemPrompt` 或为空字符串
- **THEN** 出站 messages 不含额外 system 消息（与 v1 行为一致）

### Requirement: 流式响应解析

系统 SHALL 支持流式 chat completions，增量解析 text delta 与 tool_calls 参数 JSON。

#### Scenario: 流式文本

- **WHEN** 模型流式返回 text delta
- **THEN** `callModel` yield `StreamEvent` 类型为 text delta 的事件

#### Scenario: 流式 tool_calls

- **WHEN** 模型流式返回分片的 `tool_calls` 参数
- **THEN** 适配层组装完整 `tool_use` 块后再交给循环

### Requirement: 工具 schema 出站

系统 SHALL 将注册的 `Tool` 列表转换为 OpenAI `tools` JSON Schema 格式传给 API。

#### Scenario: Echo 与 Read 出现在 tools 列表

- **WHEN** 发起模型调用且注册了 Echo、Read
- **THEN** 请求体 `tools` 数组包含两个工具的定义
