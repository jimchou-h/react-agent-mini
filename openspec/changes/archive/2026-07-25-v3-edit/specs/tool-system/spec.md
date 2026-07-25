## ADDED Requirements

### Requirement: Edit 工具注册

`getTools()` SHALL 包含 `Edit` 工具。

#### Scenario: 工具表含 Edit

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Edit'` 的工具
