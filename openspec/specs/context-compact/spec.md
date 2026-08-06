# context-compact Specification

## Purpose

Context Budget：在每轮调用模型前对出站消息做确定性裁剪（tool_result 截断、microcompact、保尾），并在达到阈值时可选 LLM autocompact 摘要写回会话；REPL 可观测上下文占用百分比。

## Requirements

### Requirement: 出站消息裁剪

系统 SHALL 在调用模型前对将发送的消息列表应用 compact 策略（可配置关闭）。确定性层（tool_result 截断、microcompact、保尾）默认仍为出站-only；LLM autocompact 成功时 SHALL 写回会话内存（见 autocompact 要求）。

#### Scenario: 默认启用截断超长 tool_result

- **WHEN** 某条 `tool_result.content` 超过配置的字符上限且 compact 启用
- **THEN** 发往模型的该字段被截断并带有截断说明；若未发生 LLM compact，会话内存中的原消息可保持不变

#### Scenario: 关闭 compact

- **WHEN** 环境变量或选项禁用 compact（如 `COMPACT=0`）
- **THEN** 发往模型的消息与会话历史一致，不做确定性裁剪，也不做 autocompact

### Requirement: 消息数量上限

当消息条数超过配置上限时，系统 SHALL 丢弃较早的对话消息，保留最近的完整轮次；裁剪边界 SHALL 对齐 user 纯文本消息，不裁断 `tool_use`/`tool_result` 配对（找不到安全边界时可放弃裁剪）。

#### Scenario: 超长历史保留尾部

- **WHEN** messages 长度大于 `maxMessages`
- **THEN** 出站列表长度不超过上限，且包含最新的 user/assistant/tool 轮次

### Requirement: 阈值触发加重裁剪

系统 SHALL 在出站消息估算规模低于配置阈值时避免丢弃整轮历史；超过阈值时才应用保尾等加重策略。

#### Scenario: 低于阈值不丢轮次

- **WHEN** 出站估算字符数低于阈值且未触发其它硬限制
- **THEN** 不因 `maxMessages` 丢弃较早轮次（单条超长 tool_result 仍可截断）

#### Scenario: 超过阈值启用加重策略

- **WHEN** 出站估算超过阈值且 compact 启用
- **THEN** 系统应用保尾等策略（及可选的 content-clear microcompact），使出站规模回落

### Requirement: microcompact

系统默认 SHALL NOT 在出站超阈值时将旧 `tool_result` 替换为 `[Old tool result content cleared]`（对齐 claude-code：legacy 出站 content-clear 路径已移除；压力由单条截断、保尾与 autocompact 承担）。

当显式启用 content-clear（如选项 `microContentClear` 或环境变量 `COMPACT_MICRO_CONTENT_CLEAR=1`）时，系统 SHALL 能将较早轮次中、属于 COMPACTABLE 工具的超长 `tool_result` 替换为短占位，且不破坏配对；占位文案 SHALL 为 `[Old tool result content cleared]`，并可附带 `file_path` 线索。

#### Scenario: 默认不 content-clear

- **WHEN** 出站超阈值且未显式启用 `microContentClear`
- **THEN** 不将旧 tool_result 替换为 cleared 占位

#### Scenario: 显式启用时旧 tool_result 被占位

- **WHEN** 显式启用 content-clear，且历史中较早的 COMPACTABLE 工具 `tool_result` 超过配置长度
- **THEN** 出站中该内容变为短英文占位，最近轮次的 tool_result 可保留全文（在配置的保留窗口内）

#### Scenario: 非 COMPACTABLE 工具结果不 microcompact

- **WHEN** `tool_result` 来自非 COMPACTABLE 工具（如 Echo）且启用 content-clear
- **THEN** microcompact 不替换该条内容（仍可受单条硬截断约束）

#### Scenario: 关闭 compact 时不做 microcompact

- **WHEN** `COMPACT=0` 或等价禁用
- **THEN** 不做 microcompact 与阈值加重裁剪

### Requirement: Autocompact（LLM 摘要）

当出站/上下文估算规模达到 autocompact 阈值且自动压缩启用时，系统 SHALL 发起一次无工具的侧路模型调用，将较早对话历史总结为摘要，并写回会话：插入 compact boundary，用摘要消息与保留的尾部消息替换被压缩段。失败时 SHALL fail-soft：不改写会话，本轮继续使用确定性出站裁剪；连续失败达到上限后 SHALL 熔断自动重试直至成功或会话重置。

#### Scenario: 超阈值触发摘要

- **WHEN** compact 启用、autocompact 启用，且估算占用达到配置阈值
- **THEN** 系统调用侧路摘要；成功后会话含 compact boundary 与摘要，后续出站以 boundary 之后的消息为主

#### Scenario: 摘要失败不破坏会话

- **WHEN** 侧路摘要调用失败或返回空
- **THEN** 会话消息不变，本轮仍可走 microcompact/保尾；记录警告

#### Scenario: 关闭自动仍保留确定性层

- **WHEN** `AUTOCOMPACT=0`（或等价）但 `COMPACT` 未关闭
- **THEN** 不自动 LLM 摘要；budget / microcompact / 保尾仍按原策略执行

### Requirement: 上下文占用百分比

系统 SHALL 能估算当前会话相对配置上下文窗口的占用百分比。优先使用最近一次模型响应中的 token usage（若有）；否则用字符估算近似 token。REPL SHALL 在每轮结束后展示该百分比（可标注为估算）。

#### Scenario: 轮次结束后展示占用

- **WHEN** REPL 完成一轮对话且 compact/观测启用
- **THEN** 输出含上下文占用百分比（如 `ctx ~42%`）

#### Scenario: 无 usage 时回退估算

- **WHEN** API 未提供 usage
- **THEN** 使用字符近似估算百分比，不抛错

### Requirement: 可观测

启用 TRACE 时，compact 执行 SHALL 输出摘要日志。

#### Scenario: TRACE 含 compact.run

- **WHEN** `TRACE=1` 且发生了实质裁剪
- **THEN** stderr 出现 `[trace] compact.run` 及前后规模信息
