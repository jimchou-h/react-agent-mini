### Requirement: Tool 契约

系统 SHALL 定义 `Tool` 类型，包含 `name`、`inputSchema`（Zod）、`call()`、`isReadOnly()`、`isConcurrencySafe()` 等方法，签名对齐 claude-code-best 的精简子集。

#### Scenario: 按名称查找工具

- **WHEN** 模型发起 `tool_use` 且 `name` 为已注册工具
- **THEN** `findToolByName` 返回对应 `Tool` 实例

#### Scenario: 未知工具

- **WHEN** 模型发起 `tool_use` 且 `name` 未注册
- **THEN** 系统返回 `tool_result`，`is_error` 为 true，内容为可读错误信息

### Requirement: 串行工具执行

系统 SHALL 通过 `runTools` 按顺序执行同一轮中的所有 `tool_use` 块（v0 不并发）。

#### Scenario: 单轮多个 tool_use

- **WHEN** 模型在一轮响应中返回两个 `tool_use` 块
- **THEN** 系统按出现顺序依次执行并 yield 各自的 `tool_result`

### Requirement: Echo 工具

系统 SHALL 提供 `Echo` 工具，接受 `message` 字符串参数，返回相同内容。

#### Scenario: Echo 成功

- **WHEN** 模型调用 `Echo` 且 `message` 为 `"测试"`
- **THEN** `tool_result` 内容为 `"测试"`

### Requirement: Read 工具

系统 SHALL 提供 `Read` 工具，读取本地文件文本内容并返回。

#### Scenario: 读取存在的文件

- **WHEN** 模型调用 `Read` 且 `path` 指向 `cwd` 下存在的普通文件
- **THEN** `tool_result` 包含该文件的 UTF-8 文本内容

#### Scenario: 文件不存在

- **WHEN** 模型调用 `Read` 且路径不存在
- **THEN** `tool_result` 标记为错误，说明文件不存在

#### Scenario: 文件过大

- **WHEN** 模型调用 `Read` 且文件大小超过 100KB
- **THEN** `tool_result` 标记为错误，说明超出大小限制

#### Scenario: 路径越界

- **WHEN** 模型调用 `Read` 且解析后的绝对路径不在 `process.cwd()` 子树内
- **THEN** `tool_result` 标记为错误，拒绝访问

### Requirement: v0 权限 auto-allow

系统 SHALL 在 v0 对所有工具调用返回 allow，不弹出权限确认。

#### Scenario: Read 无需人工确认

- **WHEN** 模型调用 `Read` 读取项目内文件
- **THEN** 工具立即执行，不阻塞等待用户输入
