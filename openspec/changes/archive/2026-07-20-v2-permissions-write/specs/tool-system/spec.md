## MODIFIED Requirements

### Requirement: v0 权限 auto-allow

系统 SHALL 在未注入自定义权限回调时，对只读工具调用返回 allow，不弹出权限确认。

#### Scenario: Read 无需人工确认

- **WHEN** 模型调用 `Read` 读取项目内文件且使用默认权限策略
- **THEN** 工具立即执行，不阻塞等待用户输入

### Requirement: Tool 契约

系统 SHALL 定义 `Tool` 类型，包含 `name`、`inputSchema`（Zod）、`call()`、`isReadOnly()`、`isConcurrencySafe()` 等方法，签名对齐 claude-code-best 的精简子集。

#### Scenario: 按名称查找工具

- **WHEN** 模型发起 `tool_use` 且 `name` 为已注册工具
- **THEN** `findToolByName` 返回对应 `Tool` 实例

#### Scenario: 未知工具

- **WHEN** 模型发起 `tool_use` 且 `name` 未注册
- **THEN** 系统返回 `tool_result`，`is_error` 为 true，内容为可读错误信息

#### Scenario: Write 出现在工具表

- **WHEN** 调用 `getTools()`
- **THEN** 列表包含 `Write`
