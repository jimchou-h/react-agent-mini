## MODIFIED Requirements

### Requirement: MCP 工具发现与适配

系统 SHALL 将 MCP `list_tools` 结果适配为内部 `Tool`，并合并进会话可用工具列表。公开工具名 SHALL 对 server id 与原始 tool 名应用 `normalizeNameForMCP`（`.` 与空格替换为 `_`），再拼接为 `mcp__<server>__<tool>`。

#### Scenario: 工具出现在 getTools 合并结果

- **WHEN** MCP server 暴露名为 `foo.bar` 的工具且 server id 为 `my.server`
- **THEN** 会话工具列表包含规范化后的唯一名称（如 `mcp__my_server__foo_bar`）

#### Scenario: 调用转发

- **WHEN** 模型调用已适配的 MCP 工具且权限 allow
- **THEN** 系统向该 MCP server 发起 `tools/call`，并将结果写入 `tool_result`

#### Scenario: MCP 调用失败

- **WHEN** MCP `tools/call` 抛错、超时，或返回带 `isError: true` 的结果
- **THEN** `tool_result` 标记 `is_error`，内容为可读错误信息（或 MCP 返回的文本）

#### Scenario: image content 省略载荷

- **WHEN** MCP `tools/call` 的 `content` 含 `type: image` 块
- **THEN** 写入 `tool_result` 的文本不含 base64 载荷，仅保留可读占位提示；同批 `text` 块仍保留
