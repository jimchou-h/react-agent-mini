## MODIFIED Requirements

### Requirement: 出站消息裁剪

系统 SHALL 在调用模型前对将发送的消息列表应用 compact 策略（可配置关闭）。确定性层（tool_result 截断、microcompact、保尾）默认仍为出站-only；LLM autocompact 成功时 SHALL 写回会话内存（见 autocompact 要求）。

#### Scenario: 默认启用截断超长 tool_result

- **WHEN** 某条 `tool_result.content` 超过配置的字符上限且 compact 启用
- **THEN** 发往模型的该字段被截断并带有截断说明；若未发生 LLM compact，会话内存中的原消息可保持不变

#### Scenario: 关闭 compact

- **WHEN** 环境变量或选项禁用 compact（如 `COMPACT=0`）
- **THEN** 发往模型的消息与会话历史一致，不做确定性裁剪，也不做 autocompact

## ADDED Requirements

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
