## ADDED Requirements

### Requirement: 阈值触发加重裁剪

系统 SHALL 在出站消息估算规模低于配置阈值时避免丢弃整轮历史；超过阈值时才应用 microcompact 与/或消息保尾等加重策略。

#### Scenario: 低于阈值不丢轮次

- **WHEN** 出站估算字符数低于阈值且未触发其它硬限制
- **THEN** 不因 `maxMessages` 丢弃较早轮次（单条超长 tool_result 仍可截断）

#### Scenario: 超过阈值启用加重策略

- **WHEN** 出站估算超过阈值且 compact 启用
- **THEN** 系统先尝试 microcompact，必要时再应用保尾等策略，使出站规模回落

### Requirement: microcompact

系统 SHALL 能将较早轮次中超长的 `tool_result` 内容替换为短占位提示，且不破坏 `tool_use` / `tool_result` 配对。

#### Scenario: 旧 tool_result 被占位

- **WHEN** 历史中较早的 `tool_result` 超过配置长度且触发 microcompact
- **THEN** 出站中该内容变为短占位（含可重新获取的提示），最近轮次的 tool_result 可保留全文（在配置的保留窗口内）

#### Scenario: 关闭 compact 时不做 microcompact

- **WHEN** `COMPACT=0` 或等价禁用
- **THEN** 不做 microcompact 与阈值加重裁剪
