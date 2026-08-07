# permission-rules Specification

## Purpose
TBD - created by archiving change v7-permission-rules. Update Purpose after archive.
## Requirements
### Requirement: 会话级 allow 规则

系统 SHALL 支持在会话内记录「允许某工具（及可选路径模式）」的规则。命中规则的写操作 SHALL 跳过交互确认。

#### Scenario: 记住后跳过确认

- **WHEN** 用户对本轮 Write 选择始终允许，随后再次调用同工具命中规则
- **THEN** 不再询问 y/N，直接执行（仍受其他硬性拒绝约束）

#### Scenario: 默认仍确认

- **WHEN** 无匹配规则且处于 REPL
- **THEN** 非只读工具仍需确认

