## ADDED Requirements

### Requirement: Host 解析 @server:uri 并精确读取

系统 SHALL 能从文本中解析 MCP 资源引用，形态为 `@<server>:<uri>`（`server` 与 `uri` 以第一个 `:` 分隔；`uri` 可含 `://`）。对每个去重后的引用，Host SHALL 在对应已连接且声明 `resources` 的 server 上执行 `resources/read`，并将文本正文格式化为可注入的 meta 用户消息（含 server / uri / 可选 name）。单条正文超限时 SHALL 截断（与既有 Resource 注入上限同量级）。系统 SHALL NOT 在缺少 `@server:uri` 时对该 server 执行全量 Resources 挂载。

#### Scenario: 解析并读取合法引用

- **WHEN** 文本含 `@tour:docs://handbook`，且 `tour` 已连接、声明 resources、该 uri 可读
- **THEN** Host 返回至少一条含该资源正文的 meta 消息

#### Scenario: 忽略未连接或失败的引用

- **WHEN** 文本含 `@missing:docs://x` 或 read 失败
- **THEN** Host 记录警告并跳过该引用，不因此中断其它引用或 prompt 注入

#### Scenario: 无引用时不自动挂载

- **WHEN** 文本不含任何 `@server:uri`
- **THEN** Host 返回空的 Resource meta 消息列表（不做全量 list+read）

## MODIFIED Requirements

### Requirement: MCP Resources 发现与读取

系统 SHALL 能对已连接且声明 `resources` 能力的 MCP server 执行 `resources/list` 与 `resources/read`。list 失败或无能力时 SHALL fail-soft 返回空列表；read 在 server 无效或无能力时 SHALL 返回可读错误。除模型经 `ReadMcpResourceTool` 主动读取外，Host SHALL 亦支持在 MCP prompt 注入路径中按 `@server:uri` 精确读取（见本 spec 新增要求）。

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
