## ADDED Requirements

### Requirement: REPL 支持 /init

`parseSlashCommand`（或等价）SHALL 识别 `/init`；`runReplSession` SHALL 按 slash-init 能力执行注入与查询。

#### Scenario: 解析 /init

- **WHEN** 输入行为 `/init` 或 `/init` 加参数
- **THEN** 解析为 init 命令而非未知 slash
