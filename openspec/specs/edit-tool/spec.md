# edit-tool Specification

## Purpose

`Edit` 工具：在 `cwd` 内已存在文件中做精确字符串替换（`old_string` → `new_string`），默认唯一匹配，可选 `replace_all`。匹配支持 CRLF 规范化与去行尾空白唯一回退。

## Requirements

### Requirement: Edit 工具

系统 SHALL 提供 `Edit` 工具，在 `cwd` 内已存在文件中把 `old_string` 替换为 `new_string`。入参路径字段 SHALL 为 `file_path`。匹配前 SHALL 将文件内容中的 CRLF 规范为 LF 视图；精确匹配失败时，SHALL 尝试在去除行尾空白后的视图上查找唯一匹配（命中则按实际原文切片替换）。

#### Scenario: 唯一匹配替换成功

- **WHEN** 模型调用 `Edit` 且 `old_string` 在目标文件中恰好出现一次、权限 allow
- **THEN** 文件中该处被替换为 `new_string`，`tool_result` 表示成功

#### Scenario: CRLF 文件可用 LF 风格 old_string 命中

- **WHEN** 文件含 CRLF 换行且 `old_string` 使用 LF 换行、在规范化视图中唯一匹配
- **THEN** 替换成功，写回换行风格与原文件检测策略一致

#### Scenario: 多次匹配且未 replace_all

- **WHEN** `old_string` 出现多次且 `replace_all` 不为 true
- **THEN** `tool_result` 标记为错误，文件不变更

#### Scenario: replace_all

- **WHEN** `replace_all` 为 true 且至少一处匹配
- **THEN** 所有匹配处被替换

#### Scenario: 未找到 old_string

- **WHEN** 规范化与去行尾空白尝试后仍不存在唯一可替换目标
- **THEN** `tool_result` 标记为错误，文件不变更，错误信息可提示检查换行/空白

#### Scenario: 路径越界

- **WHEN** `file_path` 逃出 cwd
- **THEN** `tool_result` 标记为错误，不读写

#### Scenario: 非只读

- **WHEN** 检查 `EditTool.isReadOnly`
- **THEN** 返回 `false`
