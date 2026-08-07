# mcp-resources Specification

## Purpose

MCP Resources Host 能力：list/read 资源，并通过 `ListMcpResourcesTool` / `ReadMcpResourceTool` 暴露给模型（对齐 claude-code）。
## Requirements
### Requirement: Host 解析 @server:uri 并精确读取

系统 SHALL 能从文本中解析 MCP 资源引用，形态为 `@<server>:<uri>`（`server` 与 `uri` 以第一个 `:` 分隔；`uri` 可含 `://`）。对每个去重后的引用，Host SHALL 在对应已连接且声明 `resources` 的 server 上执行 `resources/read`，并将文本正文格式化为可注入的 meta 用户消息（含 server / uri / 可选 name）。单条正文超限时 SHALL 截断（与既有 Resource 注入上限同量级）。系统 SHALL NOT 在缺少 `@server:uri` 时对该 server 执行全量 Resources 挂载。该解析 SHALL 适用于 MCP prompt 注入文本与普通用户输入文本。

#### Scenario: 解析并读取合法引用

- **WHEN** 文本含 `@tour:docs://handbook`，且 `tour` 已连接、声明 resources、该 uri 可读
- **THEN** Host 返回至少一条含该资源正文的 meta 消息

#### Scenario: 忽略未连接或失败的引用

- **WHEN** 文本含 `@missing:docs://x` 或 read 失败
- **THEN** Host 记录警告并跳过该引用，不因此中断其它引用或本轮注入

#### Scenario: 无引用时不自动挂载

- **WHEN** 文本不含任何 `@server:uri`
- **THEN** Host 返回空的 Resource meta 消息列表（不做全量 list+read）

### Requirement: MCP Resources 发现与读取

系统 SHALL 能对已连接且声明 `resources` 能力的 MCP server 执行 `resources/list` 与 `resources/read`。list 失败或无能力时 SHALL fail-soft 返回空列表；read 在 server 无效或无能力时 SHALL 返回可读错误。除模型经 `ReadMcpResourceTool` 主动读取外，Host SHALL 亦支持在 MCP prompt 与普通用户输入路径中按 `@server:uri` 精确读取（见本 spec 新增要求）。

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

### Requirement: MCP 资源失败可读

Resource 解析/读取失败时，系统 SHALL 给出可读警告或错误，SHALL NOT 在无说明时继续假装成功。

#### Scenario: resource 挂载失败有提示

- **WHEN** `@server:uri` 无法读取
- **THEN** 打印可读失败信息

