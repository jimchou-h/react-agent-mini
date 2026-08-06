## ADDED Requirements

### Requirement: WebFetch 注册

`getTools()` SHALL 包含名为 `WebFetch` 的工具。

#### Scenario: 工具表含 WebFetch

- **WHEN** 调用顶层 `getTools()`
- **THEN** 列表存在 `name === 'WebFetch'`
