## ADDED Requirements

### Requirement: WebSearch 注册

`getTools()` SHALL 包含名为 `WebSearch` 的工具。

#### Scenario: 工具表含 WebSearch

- **WHEN** 调用顶层 `getTools()`
- **THEN** 列表存在 `name === 'WebSearch'`
