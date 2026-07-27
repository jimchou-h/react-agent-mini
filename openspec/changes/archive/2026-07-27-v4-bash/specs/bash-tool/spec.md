## ADDED Requirements

### Requirement: Bash 工具

系统 SHALL 提供 `Bash` 工具，在当前工作目录执行一条 shell 命令并返回捕获的输出。

#### Scenario: 成功执行并返回输出

- **WHEN** 模型调用 `Bash` 且权限 allow、命令在超时内以退出码 0 结束
- **THEN** `tool_result` 包含命令输出（或明确的空输出说明），文件/进程副作用以命令为准

#### Scenario: 非零退出码

- **WHEN** 命令结束且退出码非 0
- **THEN** `tool_result` 标记为错误（或等价失败语义），并尽可能包含已捕获的 stdout/stderr，便于模型诊断

#### Scenario: 超时

- **WHEN** 命令超过配置的 `timeout_ms`（含默认值与硬顶）
- **THEN** 系统终止该进程（尽力而为），`tool_result` 标记为错误并说明超时

#### Scenario: 输出截断

- **WHEN** 捕获输出超过配置的字符上限
- **THEN** 返回内容截断并附截断说明，不因输出过大而拖垮上下文

#### Scenario: 非只读

- **WHEN** 检查 `BashTool.isReadOnly`
- **THEN** 返回 `false`
