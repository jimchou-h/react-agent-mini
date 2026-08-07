## ADDED Requirements

### Requirement: 规则层接入 canUseTool

权限回调 SHALL 在询问用户前检查会话规则；headless 默认策略不变，除非规则或既有 env 放行。

#### Scenario: headless 无规则仍 deny 写

- **WHEN** headless 调用 Write 且无放行规则/env
- **THEN** deny
