## ADDED Requirements

### Requirement: query 透传 systemPrompt

`query()` / `QueryParams` SHALL 支持可选 `systemPrompt`，并在每轮 `callModel` 时透传。

#### Scenario: 透传到 deps.callModel

- **WHEN** 调用 `query({ systemPrompt: "规则…", ... })`
- **THEN** 每次 `deps.callModel` 收到相同的 `systemPrompt`
