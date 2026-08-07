## ADDED Requirements

### Requirement: 上下文状态可查询

REPL SHALL 提供查看当前上下文占用的途径（现有 ctx 行、`/status` 或等价）。

#### Scenario: 用户可看到占用

- **WHEN** 完成一轮对话或查询状态
- **THEN** 用户能获知当前 context 占用估计
