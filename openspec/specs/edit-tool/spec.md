# edit-tool Specification

## Purpose

`Edit` 工具：在 `cwd` 内已存在文件中做精确字符串替换（`old_string` → `new_string`），默认唯一匹配，可选 `replace_all`。

## Requirements

### Requirement: Edit 工具

系统 SHALL 提供 `Edit` 工具，在 `cwd` 内已存在文件中把 `old_string` 替换为 `new_string`。

#### Scenario: 唯一匹配替换成功

- **WHEN** 模型调用 `Edit` 且 `old_string` 在目标文件中恰好出现一次、权限 allow
- **THEN** 文件中该处被替换为 `new_string`，`tool_result` 表示成功

#### Scenario: 多次匹配且未 replace_all

- **WHEN** `old_string` 出现多次且 `replace_all` 不为 true
- **THEN** `tool_result` 标记为错误，文件不变更

#### Scenario: replace_all

- **WHEN** `replace_all` 为 true 且至少一处匹配
- **THEN** 所有匹配处被替换

#### Scenario: 未找到 old_string

- **WHEN** 文件中不存在 `old_string`
- **THEN** `tool_result` 标记为错误，文件不变更

#### Scenario: 路径越界

- **WHEN** `path` 逃出 cwd
- **THEN** `tool_result` 标记为错误，不读写

#### Scenario: 非只读

- **WHEN** 检查 `EditTool.isReadOnly`
- **THEN** 返回 `false`
