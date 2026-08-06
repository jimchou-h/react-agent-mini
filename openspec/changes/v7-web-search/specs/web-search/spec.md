## ADDED Requirements

### Requirement: WebSearch 工具

系统 SHALL 提供内置 `WebSearch` 工具。调用入参 SHALL 包含必填非空 `query`。系统 SHALL 通过配置的搜索 adapter 执行检索，并将结果以含 `title`、`url` 与可选 `snippet` 的列表返回为 tool_result。

#### Scenario: 成功检索

- **WHEN** 模型调用 `WebSearch` 且 adapter 返回若干命中
- **THEN** tool_result 包含可解析的标题与 URL 列表

#### Scenario: 缺少 API Key

- **WHEN** 未配置所需搜索 API Key
- **THEN** 返回 is_error 的可读说明，不抛未处理异常

### Requirement: WebSearch 可中止

当 `abortController` 在检索期间 aborted 时，WebSearch SHALL 尽快停止并返回错误或中止结果，SHALL NOT 无限等待网络。

#### Scenario: 检索中 abort

- **WHEN** 调用 WebSearch 过程中 signal aborted
- **THEN** 工具调用结束且不继续产出后续网络请求
