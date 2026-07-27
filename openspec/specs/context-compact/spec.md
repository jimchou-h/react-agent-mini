# context-compact Specification

## Purpose

Context Budget：在每轮调用模型前对出站消息做确定性裁剪（tool_result 截断 + maxMessages 保尾），让长会话可续跑；不做 LLM 摘要。

## Requirements

### Requirement: 出站消息裁剪

系统 SHALL 在调用模型前对将发送的消息列表应用 compact 策略（可配置关闭）。

#### Scenario: 默认启用截断超长 tool_result

- **WHEN** 某条 `tool_result.content` 超过配置的字符上限且 compact 启用
- **THEN** 发往模型的该字段被截断并带有截断说明，会话内存中的原消息可保持不变（出站-only）

#### Scenario: 关闭 compact

- **WHEN** 环境变量或选项禁用 compact
- **THEN** 发往模型的消息与会话历史一致，不做裁剪

### Requirement: 消息数量上限

当消息条数超过配置上限时，系统 SHALL 丢弃较早的对话消息，保留最近的完整轮次；裁剪边界 SHALL 对齐 user 纯文本消息，不裁断 `tool_use`/`tool_result` 配对（找不到安全边界时可放弃裁剪）。

#### Scenario: 超长历史保留尾部

- **WHEN** messages 长度大于 `maxMessages`
- **THEN** 出站列表长度不超过上限，且包含最新的 user/assistant/tool 轮次

### Requirement: microcompact

系统 SHALL 能将较早轮次中、属于 COMPACTABLE 工具（Read、Write、Edit、Bash、Grep、Glob 及同类内置工具）的超长 `tool_result` 内容替换为短占位提示，且不破坏 `tool_use` / `tool_result` 配对。占位文案 SHALL 对齐 claude-code（如 `[Old tool result content cleared]`），并可附带 `file_path` 线索（自对应 `tool_use.input` 读取）。

#### Scenario: 旧 tool_result 被占位

- **WHEN** 历史中较早的 COMPACTABLE 工具 `tool_result` 超过配置长度且触发 microcompact
- **THEN** 出站中该内容变为短英文占位（含可重新获取的提示），最近轮次的 tool_result 可保留全文（在配置的保留窗口内）

#### Scenario: 非 COMPACTABLE 工具结果不 microcompact

- **WHEN** `tool_result` 来自非 COMPACTABLE 工具（如 Echo）
- **THEN** microcompact 不替换该条内容（仍可受单条硬截断约束）

#### Scenario: 关闭 compact 时不做 microcompact

- **WHEN** `COMPACT=0` 或等价禁用
- **THEN** 不做 microcompact 与阈值加重裁剪

### Requirement: 可观测

启用 TRACE 时，compact 执行 SHALL 输出摘要日志。

#### Scenario: TRACE 含 compact.run

- **WHEN** `TRACE=1` 且发生了实质裁剪
- **THEN** stderr 出现 `[trace] compact.run` 及前后规模信息
