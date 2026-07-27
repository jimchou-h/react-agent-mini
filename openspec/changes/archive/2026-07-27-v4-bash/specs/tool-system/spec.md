## ADDED Requirements

### Requirement: Bash 工具注册

`getTools()` SHALL 包含 `Bash` 工具。

#### Scenario: 工具表含 Bash

- **WHEN** 调用 `getTools()`
- **THEN** 返回列表中存在 `name === 'Bash'` 的工具
