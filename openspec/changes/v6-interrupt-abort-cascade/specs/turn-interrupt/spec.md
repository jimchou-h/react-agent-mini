## ADDED Requirements

### Requirement: 运行中 interrupt 中止当前 turn

当 REPL（或等价交互入口）存在进行中的 Agent turn 时，用户第一次 interrupt（SIGINT / Ctrl+C 或入口暴露的等价 abort API）SHALL 触发当前轮 `AbortController.abort`，SHALL NOT 因此立即退出进程。本轮结束后会话 SHALL 仍可接受后续输入。

#### Scenario: turn 进行中第一次 Ctrl+C

- **WHEN** REPL 正在执行一轮 `runTurn` / `query`，用户触发第一次 interrupt
- **THEN** 当前轮的 `abortController` 进入 aborted，本轮以中止结束，进程仍存活且可继续提示输入

#### Scenario: 无进行中 turn 时 interrupt

- **WHEN** REPL 空闲（无进行中 turn），用户触发 interrupt
- **THEN** 进程按入口约定退出（或等价结束 REPL），SHALL NOT 误 abort 下一轮尚未开始的 turn

### Requirement: 程序化 abort 与 interrupt 等价

系统 SHALL 允许通过当前轮 `AbortController`（或 `QueryEngine` 暴露的 abort 当前轮 API）达到与用户 interrupt 相同的本轮中止效果，以便测试与嵌入调用。

#### Scenario: 外部 abort 当前轮

- **WHEN** 测试或宿主在 `runTurn` 期间调用当前轮 abort
- **THEN** 行为与用户 interrupt 一致：本轮中止，会话历史仍可用于后续 turn
