# turn-interrupt Specification

## Purpose

定义 REPL / CLI 中用户 interrupt（Ctrl+C / SIGINT）与当前 turn abort、idle 双击退出、以及同步 Agent 级联停止的对外行为。
## Requirements
### Requirement: 运行中 interrupt 中止当前 turn

当 REPL 存在进行中 turn 时，第一次 interrupt SHALL abort 当前轮且不立即退出；结束后可继续输入。空闲行为以本文件「三段 interrupt」要求为准（不再要求空闲第一次即退出）。

#### Scenario: turn 进行中第一次 Ctrl+C

- **WHEN** 正在 `runTurn`，用户第一次 interrupt
- **THEN** 当前 abortController aborted，本轮中止，进程仍可回到提示符

### Requirement: 程序化 abort 与 interrupt 等价

系统 SHALL 允许通过当前轮 `AbortController`（或 `QueryEngine` 暴露的 abort 当前轮 API）达到与用户 interrupt 相同的本轮中止效果，以便测试与嵌入调用。

#### Scenario: 外部 abort 当前轮

- **WHEN** 测试或宿主在 `runTurn` 期间调用当前轮 abort
- **THEN** 行为与用户 interrupt 一致：本轮中止，会话历史仍可用于后续 turn

### Requirement: idle / running / cleanup 三段 interrupt

系统 SHALL 区分空闲、运行中、首次 abort 后的收尾态：

- 空闲：第一次 interrupt 不退出；短窗口内第二次退出
- 运行中：第一次 interrupt abort 当前 turn，会话可继续
- 收尾中：第二次 interrupt 允许强制退出

#### Scenario: idle 双击退出

- **WHEN** 无进行中 turn，用户在窗口内连续两次 interrupt
- **THEN** 第二次触发退出 REPL

#### Scenario: cleanup 强退

- **WHEN** 已 abort 当前 turn 但仍在收尾，用户再次 interrupt
- **THEN** 强制结束进程或等价退出，不无限等待

### Requirement: Ink 路径下的 interrupt 触发

在 Ink REPL 中，系统 SHALL 通过 Ink 输入处理（及必要时 `process` 的 `SIGINT`）触发与既有规格相同的 idle / running / cleanup 三段 interrupt 行为。行为语义（双击退出、运行中 abort、收尾强退）SHALL 与本文件既有要求一致；仅事件源可不同于 readline。

#### Scenario: Ink REPL 运行中第一次 Ctrl+C

- **WHEN** Ink REPL 正在 `runTurn`，用户第一次发送 interrupt（Ctrl+C）
- **THEN** 当前 abortController aborted，本轮中止，进程仍回到可输入状态

#### Scenario: Ink REPL idle 双击退出

- **WHEN** Ink REPL 无进行中 turn，用户在窗口内连续两次 interrupt
- **THEN** 第二次触发退出 REPL

