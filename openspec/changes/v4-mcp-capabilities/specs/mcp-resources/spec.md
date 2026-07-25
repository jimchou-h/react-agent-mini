## ADDED Requirements

### Requirement: MCP Resources 发现与读取

系统 SHALL 能对已连接且声明 resources 能力的 MCP server 执行资源列表与读取，并将文本（或截断后的）内容提供给模型侧消费通道。

#### Scenario: 列出资源

- **WHEN** server 暴露 resources 且 Host 请求 list
- **THEN** 返回可用资源标识（如 uri）列表

#### Scenario: 读取资源

- **WHEN** Host 读取合法 uri 且权限策略允许（只读路径）
- **THEN** 返回资源内容；过大时截断并说明

#### Scenario: server 无 resources

- **WHEN** server 未声明 resources
- **THEN** 跳过该能力且不影响 tools 调用

### Requirement: 只读入口（Tool 或等价）

系统 SHALL 提供可被 ReAct 调用的只读入口以读取 MCP 资源（工具名实现自定，但须可测）。

#### Scenario: 经工具读取

- **WHEN** 模型调用该只读入口并给出有效 uri、权限 allow
- **THEN** `tool_result` 含资源内容或可读错误
