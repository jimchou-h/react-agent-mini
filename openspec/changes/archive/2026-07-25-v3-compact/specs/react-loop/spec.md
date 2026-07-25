## ADDED Requirements

### Requirement: query 调用前 compact

`query()` SHALL 支持可选 compact 配置，并在每轮 `callModel` 前应用于出站 messages。

#### Scenario: callModel 收到裁剪后的 messages

- **WHEN** 历史含超长 tool_result 且 compact 启用
- **THEN** `deps.callModel` 入参 messages 中对应内容已截断
