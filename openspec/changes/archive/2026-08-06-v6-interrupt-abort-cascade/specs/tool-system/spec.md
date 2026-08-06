## ADDED Requirements

### Requirement: 同步 Agent 随父轮 abort 停止

当父会话的 `abortController` 在同步 `Agent` 工具执行期间被 abort 时，子会话的 abort 信号 SHALL 随之 aborted，子 `query` SHALL 停止继续调用模型或工具。SHALL NOT 在父已 abort 后继续长时间运行子 Agent 循环。

#### Scenario: 父 interrupt 时正在跑的 Agent 停止

- **WHEN** 父 turn 正在执行 `Agent`（子 `query` 进行中），父 `abortController` 被 abort（用户 interrupt 或等价）
- **THEN** 子 context 的 `abortController` 亦为 aborted，Agent 工具调用结束且不再发起新的子轮模型请求
