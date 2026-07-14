## ADDED Requirements

### Requirement: Glob 文件匹配

系统 SHALL 提供 `Glob` 工具，在 `cwd` 子树内按 glob 模式列举文件路径。

#### Scenario: 默认搜索 cwd

- **WHEN** 模型调用 `Glob` 且提供 `pattern`、未提供 `path`
- **THEN** 返回 cwd 下匹配的文件路径列表（相对或规范化路径）

#### Scenario: 指定子目录

- **WHEN** 模型调用 `Glob` 且 `path` 为 cwd 内目录
- **THEN** 仅在该目录子树内匹配

#### Scenario: 结果数量上限

- **WHEN** 匹配文件数超过 100
- **THEN** 返回前 100 条并注明已截断

#### Scenario: 路径越界拒绝

- **WHEN** 模型调用 `Glob` 且 `path` 逃出 cwd
- **THEN** `tool_result` 标记为错误
