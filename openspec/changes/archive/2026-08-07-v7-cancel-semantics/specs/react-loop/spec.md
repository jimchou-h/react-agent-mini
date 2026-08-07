## ADDED Requirements

### Requirement: abort 来源统一为可预期中止

`query` 因用户 interrupt、权限 deny 触发的 abort、或 callModel 可识别 AbortError 而结束时，SHALL 返回 `{ reason: 'aborted' }`（或既有等价），并保持 tool_use/tool_result 配对规则。

#### Scenario: 流中 AbortError

- **WHEN** callModel 因 abort 抛出 AbortError
- **THEN** query terminal 为 aborted，不作为未处理崩溃抛出
