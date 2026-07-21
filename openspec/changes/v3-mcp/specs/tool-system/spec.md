## ADDED Requirements

### Requirement: 动态工具合并

会话工具列表 SHALL 支持在内置工具之外合并外部来源（MCP）工具，且名称唯一。

#### Scenario: 与内置同名时不覆盖

- **WHEN** MCP 工具原始名与内置工具冲突
- **THEN** 合并后的公开名使用带前缀的唯一名称，内置工具保持原名可用
