# mcp-resources Specification

## Purpose

MCP Resources Host 能力：list/read 资源，并通过 `ListMcpResourcesTool` / `ReadMcpResourceTool` 暴露给模型（对齐 claude-code）。

## Requirements

### Requirement: MCP Resources 发现与读取

系统 SHALL 能对已连接且声明 `resources` 能力的 MCP server 执行 `resources/list` 与 `resources/read`。list 失败或无能力时 SHALL fail-soft 返回空列表；read 在 server 无效或无能力时 SHALL 返回可读错误。

#### Scenario: Host 侧列出资源

- **WHEN** server 声明 `resources` 且 Host 调用内部 list API
- **THEN** 返回资源列表，每项含 `uri`、`name` 及可选 `mimeType`、`description`，并附带 `server` 字段标识来源

#### Scenario: Host 侧读取资源

- **WHEN** Host 对合法 `server` + `uri` 调用 read 且 server 已连接
- **THEN** 返回文本内容；二进制 blob SHALL 不将 base64 写入模型上下文（落盘路径或等价占位）

#### Scenario: server 无 resources

- **WHEN** server 未声明 `resources`
- **THEN** list 返回 `[]`，且不影响该 server 的 tools 调用

#### Scenario: list 失败不拖垮会话

- **WHEN** `resources/list` 抛错或超时
- **THEN** 记录警告并返回 `[]`，其它 server 与 tools 照常

### Requirement: ListMcpResourcesTool

系统 SHALL 提供只读内置工具 `ListMcpResourcesTool`，供模型列出已连接 MCP server 的资源。

#### Scenario: 列出全部 server 的资源

- **WHEN** 模型调用 `ListMcpResourcesTool` 且未提供 `server`
- **THEN** `tool_result` 含各 server 资源条目（含 `server` 字段）

#### Scenario: 按 server 过滤

- **WHEN** 模型调用 `ListMcpResourcesTool` 且 `server` 为已连接 server 名
- **THEN** 仅返回该 server 的资源

#### Scenario: 指定 server 不存在

- **WHEN** 模型提供不存在的 `server`
- **THEN** `tool_result` 标记为错误，并列出可用 server 名

#### Scenario: 无资源时的提示

- **WHEN** 无任何资源可列
- **THEN** `tool_result` 为可读说明（可提示 server 仍可能提供 tools）

### Requirement: ReadMcpResourceTool

系统 SHALL 提供只读内置工具 `ReadMcpResourceTool`，参数 SHALL 为 `server` 与 `uri`。

#### Scenario: 读取文本资源

- **WHEN** 模型调用 `ReadMcpResourceTool` 且 `server` 已连接、声明 resources、`uri` 合法
- **THEN** `tool_result` 含资源文本内容

#### Scenario: 结果过大截断

- **WHEN** 资源文本超过配置上限（约 100_000 字符）
- **THEN** 截断并附截断说明

#### Scenario: server 不存在或无 resources

- **WHEN** `server` 不存在、未连接或未声明 `resources`
- **THEN** `tool_result` 标记为错误

### Requirement: Resource 工具动态注入

当任一已连接 MCP server 声明 `resources` 能力时，会话工具表 SHALL 追加 `ListMcpResourcesTool` 与 `ReadMcpResourceTool`；全局 SHALL 只追加一次（不因多 server 重复）。

#### Scenario: 有 resources 的 server 连接后可见

- **WHEN** 至少一个 server 声明 `resources` 且连接成功
- **THEN** 合并后的会话工具列表包含上述两工具

#### Scenario: 仅 tools 的 server 不注入

- **WHEN** 所有 server 均未声明 `resources`
- **THEN** 会话工具列表不含上述两工具，行为与 v3 一致
