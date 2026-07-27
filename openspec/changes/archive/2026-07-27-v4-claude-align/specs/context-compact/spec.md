## MODIFIED Requirements

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
