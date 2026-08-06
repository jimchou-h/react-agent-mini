## MODIFIED Requirements

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
