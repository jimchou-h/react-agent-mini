## ADDED Requirements

### Requirement: Grep 内容搜索

系统 SHALL 提供 `Grep` 工具，在 `cwd` 子树内按正则搜索文件内容。

#### Scenario: 默认搜索 cwd

- **WHEN** 模型调用 `Grep` 且仅提供 `pattern`
- **THEN** 在 `process.cwd()` 下搜索并返回匹配行（含文件路径与行号）

#### Scenario: 指定子路径

- **WHEN** 模型调用 `Grep` 且 `path` 为 cwd 内相对路径
- **THEN** 仅在该路径下搜索

#### Scenario: 路径越界拒绝

- **WHEN** 模型调用 `Grep` 且 `path` 解析后逃出 cwd
- **THEN** `tool_result` 标记为错误

#### Scenario: 结果条数上限

- **WHEN** 匹配行数超过配置的 `head_limit`（默认 50）
- **THEN** 截断输出并注明已截断
