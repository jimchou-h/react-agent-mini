## ADDED Requirements

### Requirement: Skill 注入消息在 tool_result 之后

当 `Skill` 工具成功加载技能时，系统 SHALL 先将对应 `tool_use` 的 `tool_result`（短确认文案）追加到会话，再追加技能正文注入消息。系统 SHALL NOT 在含该 `tool_use` 的 assistant 消息与其配对 `tool_result` 之间插入纯文本 user 消息。

#### Scenario: 成功加载后历史顺序

- **WHEN** 模型调用 `Skill` 且技能存在
- **THEN** 会话中该 `tool_use` 之后的下一条相关消息含配对 `tool_result`，技能正文注入消息出现在该 `tool_result` 之后

#### Scenario: 未知技能不注入正文

- **WHEN** 模型调用 `Skill` 且技能不存在
- **THEN** 仅有错误 `tool_result`，不追加技能正文注入消息
