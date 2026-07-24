## ADDED Requirements

### Requirement: MCP 配置加载

系统 SHALL 从项目 `.mcp.json`（或 `MCP_CONFIG` 指定路径）读取 stdio MCP server 配置；文件不存在时跳过且不失败。`MCP_CONFIG` SHALL 支持逗号分隔的多路径；各文件的 `mcpServers` 按顺序合并，同名 server 以后载入为准。

#### Scenario: 无配置文件

- **WHEN** cwd（或配置路径）不存在 MCP 配置
- **THEN** 不启动任何 MCP 进程，会话仅含内置工具

#### Scenario: 加载 stdio server

- **WHEN** 配置含有效 `command`/`args` 的 server 条目
- **THEN** 系统启动该进程并完成 MCP initialize 握手

#### Scenario: MCP_CONFIG 多文件合并

- **WHEN** `MCP_CONFIG` 为逗号分隔的多个存在路径，且后文件与先文件含同名 server
- **THEN** 合并结果包含全部 server，且同名条目取后文件配置

### Requirement: MCP 工具发现与适配

系统 SHALL 将 MCP `list_tools` 结果适配为内部 `Tool`，并合并进会话可用工具列表。

#### Scenario: 工具出现在 getTools 合并结果

- **WHEN** MCP server 暴露名为 `foo` 的工具且 server id 为 `demo`
- **THEN** 会话工具列表包含带 server 前缀的唯一名称（如 `mcp__demo__foo`）

#### Scenario: 调用转发

- **WHEN** 模型调用已适配的 MCP 工具且权限 allow
- **THEN** 系统向该 MCP server 发起 `tools/call`，并将结果写入 `tool_result`

#### Scenario: MCP 调用失败

- **WHEN** MCP `tools/call` 抛错、超时，或返回带 `isError: true` 的结果
- **THEN** `tool_result` 标记 `is_error`，内容为可读错误信息（或 MCP 返回的文本）

#### Scenario: image content 省略载荷

- **WHEN** MCP `tools/call` 的 `content` 含 `type: image` 块
- **THEN** 写入 `tool_result` 的文本不含 base64 载荷，仅保留可读占位提示；同批 `text` 块仍保留

### Requirement: 权限复用

MCP 适配工具 SHALL 经过与内置工具相同的 `canUseTool` 流水线。

#### Scenario: 非只读 MCP 工具在 headless 默认拒绝

- **WHEN** headless 模式且未设置 `ALLOW_WRITE=1`，模型调用标注为非只读的 MCP 工具
- **THEN** `canUseTool` deny，不向 MCP 发起调用
