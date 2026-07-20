## ADDED Requirements

### Requirement: Skill 工具注册

`getTools()` SHALL 包含 `Skill` 工具，且其 `isReadOnly` 为 true。

#### Scenario: 工具表含 Skill

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Skill'` 的工具
