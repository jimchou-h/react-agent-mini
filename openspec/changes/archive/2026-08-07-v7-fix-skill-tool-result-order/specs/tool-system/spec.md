## ADDED Requirements

### Requirement: prependMessages 在 tool_result 之后 yield

当工具 `call` 返回 `prependMessages` 时，编排层 (`runTools`) SHALL 先 yield 该工具的 `tool_result` user 消息，再依次 yield `prependMessages`。系统 SHALL NOT 将 `prependMessages` 插在同一 `tool_use` 的 `tool_result` 之前。

#### Scenario: Skill 的 yield 顺序

- **WHEN** `Skill` 成功返回短确认与一条注入正文消息
- **THEN** `runTools` 产出的更新序列中，含 `tool_result` 的消息先于含技能正文 text 的消息
