## ADDED Requirements

### Requirement: MCP 资源失败可读

Resource 解析/读取失败时，系统 SHALL 给出可读警告或错误，SHALL NOT 在无说明时继续假装成功。

#### Scenario: resource 挂载失败有提示

- **WHEN** `@server:uri` 无法读取
- **THEN** 打印可读失败信息
