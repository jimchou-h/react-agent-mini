## MODIFIED Requirements

### Requirement: Write 工具

系统 SHALL 提供 `Write` 工具，将文本内容写入 `cwd` 子树内的文件。入参路径字段 SHALL 为 `file_path`。父目录不存在时 SHALL 自动创建后再写入。

#### Scenario: 写入成功

- **WHEN** 模型调用 `Write` 且 `file_path` 在 cwd 内、内容 ≤100KB、权限 allow
- **THEN** 必要父目录被创建，文件被写入 UTF-8 内容，`tool_result` 表示成功

#### Scenario: 路径越界

- **WHEN** `file_path` 解析后逃出 cwd
- **THEN** `tool_result` 标记为错误，不写入

#### Scenario: 内容过大

- **WHEN** `content` 超过 100KB
- **THEN** `tool_result` 标记为错误，不写入

#### Scenario: 非只读

- **WHEN** 检查 `WriteTool.isReadOnly`
- **THEN** 返回 `false`
