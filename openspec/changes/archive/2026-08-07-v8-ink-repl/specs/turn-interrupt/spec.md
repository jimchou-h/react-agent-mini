## ADDED Requirements

### Requirement: Ink 路径下的 interrupt 触发

在 Ink REPL 中，系统 SHALL 通过 Ink 输入处理（及必要时 `process` 的 `SIGINT`）触发与既有规格相同的 idle / running / cleanup 三段 interrupt 行为。行为语义（双击退出、运行中 abort、收尾强退）SHALL 与本文件既有要求一致；仅事件源可不同于 readline。

#### Scenario: Ink REPL 运行中第一次 Ctrl+C

- **WHEN** Ink REPL 正在 `runTurn`，用户第一次发送 interrupt（Ctrl+C）
- **THEN** 当前 abortController aborted，本轮中止，进程仍回到可输入状态

#### Scenario: Ink REPL idle 双击退出

- **WHEN** Ink REPL 无进行中 turn，用户在窗口内连续两次 interrupt
- **THEN** 第二次触发退出 REPL
