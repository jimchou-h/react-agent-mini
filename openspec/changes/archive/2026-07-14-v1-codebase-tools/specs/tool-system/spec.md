## MODIFIED Requirements

### Requirement: Read 工具

系统 SHALL 提供 `Read` 工具，读取本地文件文本内容并返回。

#### Scenario: 读取存在的文件

- **WHEN** 模型调用 `Read` 且 `path` 指向 `cwd` 下存在的普通文件
- **THEN** `tool_result` 包含该文件的 UTF-8 文本内容

#### Scenario: 分段读取

- **WHEN** 模型调用 `Read` 且提供 `offset`（起始行，1-based）与 `limit`（行数）
- **THEN** `tool_result` 仅包含指定行范围，每行带行号前缀

#### Scenario: 文件不存在

- **WHEN** 模型调用 `Read` 且路径不存在
- **THEN** `tool_result` 标记为错误，说明文件不存在

#### Scenario: 文件过大

- **WHEN** 模型调用 `Read` 且文件大小超过 100KB
- **THEN** `tool_result` 标记为错误，说明超出大小限制

#### Scenario: 路径越界

- **WHEN** 模型调用 `Read` 且解析后的绝对路径不在 `process.cwd()` 子树内
- **THEN** `tool_result` 标记为错误，拒绝访问

### Requirement: Tool 契约

系统 SHALL 定义 `Tool` 类型，包含 `name`、`inputSchema`（Zod）、`call()`、`isReadOnly()`、`isConcurrencySafe()` 等方法，签名对齐 claude-code-best 的精简子集。

#### Scenario: 按名称查找工具

- **WHEN** 模型发起 `tool_use` 且 `name` 为已注册工具
- **THEN** `findToolByName` 返回对应 `Tool` 实例

#### Scenario: 未知工具

- **WHEN** 模型发起 `tool_use` 且 `name` 未注册
- **THEN** 系统返回 `tool_result`，`is_error` 为 true，内容为可读错误信息
