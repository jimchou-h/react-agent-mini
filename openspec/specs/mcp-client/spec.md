# mcp-client Specification

## Purpose

stdio MCP 客户端：从 `.mcp.json` / `MCP_CONFIG` 加载配置，发现并适配外部工具，经 `tools/call` 转发结果，并复用既有 `canUseTool` 权限流水线。

## Requirements

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

### Requirement: 权限复用

MCP 适配工具 SHALL 经过与内置工具相同的 `canUseTool` 流水线。

#### Scenario: 非只读 MCP 工具在 headless 默认拒绝

- **WHEN** headless 模式且未设置 `ALLOW_WRITE=1`，模型调用标注为非只读的 MCP 工具
- **THEN** `canUseTool` deny，不向 MCP 发起调用

### Requirement: 能力协商后可选启用

MCP 客户端 SHALL 在 `initialize` 握手完成后读取 `getServerCapabilities()`，并据此决定是否启用 resources / prompts 路径；缺失时 fail-soft。

#### Scenario: 仅 tools 的 server 仍可用

- **WHEN** server 只声明 `tools`
- **THEN** 工具发现与 `tools/call` 行为与 v3 一致；不注入 resource 工具、不注册 MCP slash

#### Scenario: 记录 server capabilities

- **WHEN** server 连接成功
- **THEN** session 保存该 server 的 `capabilities` 供 list/read prompt 与动态工具注入使用

### Requirement: MCP session 扩展状态

`connectMcpSession`（或等价）SHALL 除 `tools` 外返回 connected clients 句柄，以及 `commands`（MCP slash 元数据），供 REPL 与内置 resource 工具使用。

#### Scenario: REPL 读取 MCP commands

- **WHEN** REPL 启动且 MCP 连接含 prompts
- **THEN** REPL 可合并 `commands` 进入本地 slash 表

#### Scenario: Resource 工具读取 clients

- **WHEN** 模型调用 `ListMcpResourcesTool` 或 `ReadMcpResourceTool`
- **THEN** 工具实现可访问 session 中的 connected clients 以路由 `resources/list` / `resources/read`

### Requirement: Resource 工具与会话工具合并

当 session 检测到 resources 能力时，SHALL 在 MCP tools 合并阶段追加 `ListMcpResourcesTool` 与 `ReadMcpResourceTool`（全局一次），再与 builtin tools 合并。

#### Scenario: mergeTools 含 resource 工具

- **WHEN** 任一 MCP server 声明 `resources`
- **THEN** `sessionTools()` 结果包含 builtin + MCP tools + 两 resource 工具
