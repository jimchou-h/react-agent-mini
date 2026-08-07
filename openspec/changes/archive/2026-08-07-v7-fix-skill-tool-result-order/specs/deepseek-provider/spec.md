## ADDED Requirements

### Requirement: tool_calls 后紧跟 role:tool

将内部消息转为 OpenAI Chat Completions 时，若某条 assistant 含 `tool_calls`，适配后的 messages 中紧随其后的消息 MUST 为对应该批 `tool_call_id` 的 `role: tool` 消息（可多条连续 tool），SHALL NOT 在配对完成前插入普通 `role: user` 文本。技能正文等附加 user 文本 MUST 出现在全部相关 `role: tool` 之后。

#### Scenario: Skill 轮次出站配对

- **WHEN** 历史为 assistant(`Skill` tool_use) → user(tool_result) → user(技能正文)
- **THEN** 适配结果为 assistant(tool_calls) → role:tool(同 id) → role:user(技能正文)

#### Scenario: 同 user 消息内 tool_result 先于 text

- **WHEN** 单条 user 消息同时含 `tool_result` 块与 text 块
- **THEN** 适配层先发出 `role: tool`，再发出 `role: user` 文本
