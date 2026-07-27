## MODIFIED Requirements

### Requirement: Grep 内容搜索

系统 SHALL 提供 `Grep` 工具，在 `cwd` 子树内按正则搜索。默认 `output_mode` SHALL 为 `files_with_matches`。未指定 `head_limit` 时默认 SHALL 为 250；`head_limit` 为 0 表示不限。

#### Scenario: 默认搜索 cwd 返回文件列表

- **WHEN** 模型调用 `Grep` 且仅提供 `pattern`
- **THEN** 在 `process.cwd()` 下搜索并返回匹配文件路径列表（`files_with_matches` 模式）

#### Scenario: content 模式返回匹配行

- **WHEN** 模型调用 `Grep` 且 `output_mode` 为 `content`
- **THEN** 返回匹配行（含文件路径与行号）

#### Scenario: 指定子路径

- **WHEN** 模型调用 `Grep` 且 `path` 为 cwd 内相对路径
- **THEN** 仅在该路径下搜索

#### Scenario: 路径越界拒绝

- **WHEN** 模型调用 `Grep` 且 `path` 解析后逃出 cwd
- **THEN** `tool_result` 标记为错误

#### Scenario: 结果条数上限

- **WHEN** 结果条数超过 `head_limit`（且 `head_limit` 非 0）
- **THEN** 截断输出并注明已截断
