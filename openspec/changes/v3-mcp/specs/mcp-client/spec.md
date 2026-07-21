## ADDED Requirements

### Requirement: MCP 配置加载

系统 SHALL 从项目 `.mcp.json`（或 `MCP_CONFIG` 指定路径）读取 stdio MCP server 配置；文件不存在时跳过且不失败。

#### Scenario: 无配置文件

- **WHEN** cwd（或配置路径）不存在 MCP 配置
- **THEN** 不启动任何 MCP 进程，会话仅含内置工具

#### Scenario: 加载 stdio server

- **WHEN** 配置含有效 `command`/`args` 的 server 条目
- **THEN** 系统启动该进程并完成 MCP initialize 握手

### Requirement: MCP 工具发现与适配

系统 SHALL 将 MCP `list_tools` 结果适配为内部 `Tool`，并合并进会话可用工具列表。

#### Scenario: 工具出现在 getTools 合并结果

- **WHEN** MCP server 暴露名为 `foo` 的工具且 server id 为 `demo`
- **THEN** 会话工具列表包含带 server 前缀的唯一名称（如 `mcp__demo__foo`）

#### Scenario: 调用转发

- **WHEN** 模型调用已适配的 MCP 工具且权限 allow
- **THEN** 系统向该 MCP server 发起 `tools/call`，并将结果写入 `tool_result`

#### Scenario: MCP 调用失败

- **WHEN** MCP `tools/call` 返回错误或超时
- **THEN** `tool_result` 标记 `is_error`，内容为可读错误信息

### Requirement: 权限复用

MCP 适配工具 SHALL 经过与内置工具相同的 `canUseTool` 流水线。

#### Scenario: 非只读 MCP 工具在 headless 默认拒绝

- **WHEN** headless 模式且未设置 `ALLOW_WRITE=1`，模型调用标注为非只读的 MCP 工具
- **THEN** `canUseTool` deny，不向 MCP 发起调用
