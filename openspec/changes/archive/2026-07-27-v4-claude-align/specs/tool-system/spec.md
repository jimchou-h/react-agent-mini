## MODIFIED Requirements

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
