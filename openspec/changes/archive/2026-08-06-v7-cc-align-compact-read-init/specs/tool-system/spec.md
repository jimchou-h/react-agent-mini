## MODIFIED Requirements

### Requirement: Read 工具

系统 SHALL 提供 `Read` 工具，读取本地文件文本内容并返回。入参路径字段 SHALL 为 `file_path`。文本结果 SHALL 带行号前缀（`行号\t内容`）；整文件与分段读取均适用。

当 `ToolUseContext` 提供 `readFileState` 时，系统 SHALL 在「同一绝对路径 + 同一 offset/limit + 磁盘 mtime 未变 + 既有条目来自 Read」时返回短 stub，而不重发全文。Stub 文案 SHALL 对齐 claude-code `FILE_UNCHANGED_STUB`（说明文件自上次 Read 未变，应参照会话中较早的 tool_result）。

成功读取后，系统 SHALL 将路径、mtime、offset/limit 与 `fromRead: true` 写入 `readFileState`。

#### Scenario: 读取存在的文件

- **WHEN** 模型调用 `Read` 且 `file_path` 指向 `cwd` 下存在的普通文件，且无可用的未变缓存
- **THEN** `tool_result` 包含带行号前缀的 UTF-8 文本内容，并更新 `readFileState`

#### Scenario: 同路径同范围未变返回 stub

- **WHEN** 模型再次 `Read` 同一文件、同一 offset/limit，且 mtime 相对 `readFileState` 未变且条目 `fromRead`
- **THEN** `tool_result` 为 `FILE_UNCHANGED_STUB` 语义的短说明，而非完整文件正文

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
