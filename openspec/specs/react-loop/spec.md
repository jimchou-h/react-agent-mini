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

### Requirement: query 透传 systemPrompt

`query()` / `QueryParams` SHALL 支持可选 `systemPrompt`，并在每轮 `callModel` 时透传。

#### Scenario: 透传到 deps.callModel

- **WHEN** 调用 `query({ systemPrompt: "规则…", ... })`
- **THEN** 每次 `deps.callModel` 收到相同的 `systemPrompt`

### Requirement: query 调用前 compact

`query()` SHALL 支持可选 compact 配置，并在每轮 `callModel` 前应用于出站 messages。

#### Scenario: callModel 收到裁剪后的 messages

- **WHEN** 历史含超长 tool_result 且 compact 启用
- **THEN** `deps.callModel` 入参 messages 中对应内容已截断

### Requirement: query 在阈值路径下仍出站-only

`query()` 应用 compact 时 SHALL 继续只修改发往模型的副本，不强制写回会话内存。

#### Scenario: microcompact 后内存可仍完整

- **WHEN** 出站发生了 microcompact
- **THEN** `deps.callModel` 入参已占位/裁剪，而传入 query 的历史数组可保持未占位原文（出站-only）

### Requirement: abort 终止后历史仍配对

当 `query` 因工具权限 abort 等原因返回 `{ reason: 'aborted' }` 时，本轮已 yield 进会话的消息 SHALL 仍满足：assistant 中每个 `tool_use` 在后续 user `tool_result` 中有对应 `tool_use_id`（含因跳过而合成的错误 result）。SHALL NOT 在缺少配对的情况下结束本轮并把孤儿 `tool_use` 留给下一轮 `callModel`。

#### Scenario: aborted 后下一轮可继续会话

- **WHEN** 用户拒绝写工具导致本轮 `aborted`，且同批尚有未执行的只读 `tool_use`
- **THEN** 那些未执行工具已有合成 `tool_result` 写入流/历史；用户再发下一条消息时，历史无孤儿 `tool_use`

### Requirement: 完成路径调用 Stop

顶层 ReAct / query 循环在得出 **completed** 终止（无待执行 tool_use）后、向调用方返回之前，SHALL 调用 Stop hooks 流水线（若启用）。处理顺序 SHALL 为：

1. 若 preventContinuation → 结束（不再进模型）
2. 若存在 blocking feedback → 注入合成 user 并在同一 `query`/`runTurn` 内再进模型轮次
3. 否则正常返回 completed

Blocking 续跑 SHALL 计入既有 maxTurns；触顶后按现有 max_turns 语义结束。因 blocking 再次进入 Stop 时，SHALL 向 hook 标明 `stop_hook_active: true`（或等价字段）。

#### Scenario: completed 后挂钩

- **WHEN** 模型返回纯文本且无 tool_use
- **THEN** 在返回 completed 前执行 Stop（若配置存在）

#### Scenario: exit 2 blocking 再进一轮

- **WHEN** Stop 以 exit 2（或 `decision: block`）返回 blocking feedback，且未 preventContinuation
- **THEN** 会话将 feedback 作为合成 user 注入并再调用模型至少一轮

#### Scenario: continue false 直接结束

- **WHEN** Stop 声明 `continue: false`
- **THEN** 不再进入模型轮次，本轮以已完成的 assistant 结果结束

#### Scenario: blocking 受 maxTurns 约束

- **WHEN** Stop 反复 blocking 请求续跑
- **THEN** 不得超过既有 maxTurns；触顶后按现有 max_turns 语义结束
