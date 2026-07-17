# trace-debug Specification

## Purpose

环境变量 `TRACE=1` 启用的结构化调试日志，覆盖 CLI→query→API→tool 关键边界；默认关闭零开销。

## Requirements

### Requirement: TRACE 环境变量开关

系统 SHALL 在 `process.env.TRACE === '1'` 时启用 trace 日志；未设置或其他值时 SHALL 不产生任何 trace 输出。

#### Scenario: 默认关闭

- **WHEN** 未设置 `TRACE` 环境变量
- **THEN** 调用 `trace()` 无 stderr 输出

#### Scenario: 启用 trace

- **WHEN** `TRACE=1` 且某边界调用 `trace('stage', { key: value })`
- **THEN** stderr 打印以 `[trace]` 为前缀的结构化行

### Requirement: 关键路径埋点

启用 trace 时，系统 SHALL 至少在以下阶段输出日志：CLI 启动、query 每轮开始/结束、API 调用摘要、工具执行开始/结束。

#### Scenario: 完整一轮 Echo 的 trace

- **WHEN** `TRACE=1` 且执行 `dev:mock -- "用 Echo 回复 hi"`
- **THEN** stderr 依次出现 `cli.start`、`query.turn_start`、`tool.start`、`tool.end`、`query.turn_end` 等 stage

#### Scenario: 不记录 API Key

- **WHEN** trace 打印 `api.request` 详情
- **THEN** 输出 SHALL NOT 包含 `OPENAI_API_KEY` 或完整密钥
