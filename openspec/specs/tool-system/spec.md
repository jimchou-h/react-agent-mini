# tool-system Specification

## Purpose

定义内置工具契约、注册与执行策略，以及 Echo / Read / Grep / Glob / Bash / Skill / Write / Edit 等工具的对外行为；会话工具表可合并 MCP 等外部来源。

## Requirements

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

#### Scenario: Edit 出现在工具表

- **WHEN** 调用 `getTools()`
- **THEN** 列表包含 `Edit`

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

系统 SHALL 提供 `Read` 工具，读取本地文件文本内容并返回。入参路径字段 SHALL 为 `file_path`。文本结果 SHALL 带行号前缀（`行号\t内容`）；整文件与分段读取均适用。

#### Scenario: 读取存在的文件

- **WHEN** 模型调用 `Read` 且 `file_path` 指向 `cwd` 下存在的普通文件
- **THEN** `tool_result` 包含带行号前缀的 UTF-8 文本内容

#### Scenario: 分段读取

- **WHEN** 模型调用 `Read` 且提供 `offset`（起始行，0 视为 1）与 `limit`（行数）
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

### Requirement: v0 权限 auto-allow

系统 SHALL 在未注入自定义权限回调时，对只读工具调用返回 allow，不弹出权限确认。

#### Scenario: Read 无需人工确认

- **WHEN** 模型调用 `Read` 读取项目内文件且使用默认权限策略
- **THEN** 工具立即执行，不阻塞等待用户输入

### Requirement: Skill 工具注册

`getTools()` SHALL 包含 `Skill` 工具，且其 `isReadOnly` 为 true。

#### Scenario: 工具表含 Skill

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Skill'` 的工具

### Requirement: Edit 工具注册

`getTools()` SHALL 包含 `Edit` 工具。

#### Scenario: 工具表含 Edit

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Edit'` 的工具

### Requirement: Bash 工具注册

`getTools()` SHALL 包含 `Bash` 工具。

#### Scenario: 工具表含 Bash

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Bash'` 的工具

### Requirement: 动态工具合并

会话工具列表 SHALL 支持在内置工具之外合并外部来源（MCP）工具，且名称唯一。

#### Scenario: 与内置同名时不覆盖

- **WHEN** MCP 工具原始名与内置工具冲突
- **THEN** 合并后的公开名使用带前缀的唯一名称，内置工具保持原名可用
