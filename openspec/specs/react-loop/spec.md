# react-loop Specification

## Purpose

L2 ReAct 主循环：`query()` 在单次用户请求内循环「调用模型 → 执行工具 → 追加消息」，直到无 tool_use 或达到 maxTurns。

## Requirements

### Requirement: ReAct 多轮循环

系统 SHALL 实现 `query()` 异步生成器，在单次用户请求内循环执行「调用模型 → 执行工具 → 追加消息」，直到模型响应不再包含 `tool_use` 块。

#### Scenario: 单轮文本回复（无工具）

- **WHEN** 用户发送一个问题且模型直接返回纯文本、无 `tool_use`
- **THEN** 循环终止并 yield 最终 assistant 消息，返回 `{ reason: 'completed' }`

#### Scenario: 多轮工具调用

- **WHEN** 模型响应包含一个或多个 `tool_use` 块
- **THEN** 系统执行对应工具、将 `tool_result` 追加到消息历史，并发起下一轮模型调用

#### Scenario: 达到 maxTurns 上限

- **WHEN** 工具调用轮次超过配置的 `maxTurns`
- **THEN** 循环终止并返回 `{ reason: 'max_turns', turnCount }`

### Requirement: 循环终止信号

系统 SHALL 以「流式解析过程中是否出现 `tool_use` 块」作为 `needsFollowUp` 判定依据，SHALL NOT 仅依赖 API 返回的 `stop_reason`。

#### Scenario: stop_reason 不可靠时仍能继续

- **WHEN** API `stop_reason` 未设为 `tool_use` 但响应内容含 `tool_use` 块
- **THEN** 系统仍执行工具并进入下一轮

### Requirement: 依赖注入

系统 SHALL 通过 `query/deps.ts` 的 `QueryDeps` 注入 `callModel` 与 `uuid`，使测试可替换模型调用而无需修改 `query.ts`。

#### Scenario: 生产环境默认依赖

- **WHEN** 调用方未传入 `deps` 覆盖
- **THEN** 系统使用 `productionDeps()` 绑定真实 DeepSeek 适配层

### Requirement: 流式事件 yield

系统 SHALL 在模型流式响应过程中 yield `StreamEvent`（如 text delta），并在工具执行完成后 yield 工具结果相关的 `Message`。

#### Scenario: CLI 消费流式事件

- **WHEN** CLI 迭代 `query()` 生成器
- **THEN** CLI 可逐条接收流式 text delta 与最终消息用于终端输出
