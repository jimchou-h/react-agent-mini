## ADDED Requirements

### Requirement: QueryEngine 消息累积

系统 SHALL 提供 `QueryEngine`，在多次 `runTurn` 调用间保持并增长 `messages` 历史。

#### Scenario: 第二轮保留第一轮上下文

- **WHEN** 用户在 REPL 第一轮问「我叫 Alice」且 Agent 已回复，第二轮问「我叫什么」
- **THEN** `QueryEngine.messages` 包含两轮完整 user/assistant（及中间 tool）消息，第二轮模型可引用第一轮内容

#### Scenario: clear 重置历史

- **WHEN** 用户执行 `/clear` 或调用 `QueryEngine.clear()`
- **THEN** `messages` 变为空数组

### Requirement: QueryEngine 单轮 query 封装

系统 SHALL 通过 `runTurn(userText)` 追加用户消息、调用 `query()`、yield 流式事件，并在 turn 结束后返回 `Terminal`。

#### Scenario: runTurn yield 与 query 一致

- **WHEN** REPL 调用 `runTurn("你好")`
- **THEN** 生成器 yield 的事件类型与直接调用 `query()` 相同（`text_delta`、`assistant`、`user`）

#### Scenario: maxTurns 透传

- **WHEN** `QueryEngine` 构造时设置 `maxTurns`
- **THEN** 内部 `query()` 调用使用该上限
