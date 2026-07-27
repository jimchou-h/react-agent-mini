## ADDED Requirements

### Requirement: 能力协商后可选启用

MCP 客户端 SHALL 在 `initialize` 握手完成后读取 `getServerCapabilities()`，并据此决定是否启用 resources / prompts 路径；缺失时 fail-soft。

#### Scenario: 仅 tools 的 server 仍可用

- **WHEN** server 只声明 `tools`
- **THEN** 工具发现与 `tools/call` 行为与 v3 一致；不注入 resource 工具、不注册 MCP slash

#### Scenario: 记录 server capabilities

- **WHEN** server 连接成功
- **THEN** session 保存该 server 的 `capabilities` 供 list/read prompt 与动态工具注入使用

### Requirement: MCP session 扩展状态

`connectMcpSession`（或等价）SHALL 除 `tools` 外返回 connected clients 句柄，以及可选的 `resourcesByServer` 与 `commands`（MCP slash 元数据），供 REPL 与内置 resource 工具使用。

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
