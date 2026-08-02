## ADDED Requirements

### Requirement: 完成路径调用 Stop

顶层 ReAct / query 循环在得出 **completed** 终止（无待执行 tool_use）后、向调用方返回之前，SHALL 调用 Stop hooks 流水线（若启用）。处理顺序 SHALL 为：

1. 若 preventContinuation → 结束（不再进模型）
2. 若存在 blocking feedback → 注入合成 user 并在同一 `query`/`runTurn` 内再进模型轮次
3. 否则正常返回 completed

Blocking 续跑 SHALL 计入既有 maxTurns；触顶后按现有 max_turns 语义结束。因 blocking 再次进入 Stop 时，SHALL 向 hook 标明 `stop_hook_active: true`（或等价字段）。

#### Scenario: completed 后挂钩

- **WHEN** 模型返回纯文本且无 tool_use
- **THEN** 在返回 completed 前执行 Stop（若配置存在）

#### Scenario: exit 2 blocking 再进一轮

- **WHEN** Stop 以 exit 2（或 `decision: block`）返回 blocking feedback，且未 preventContinuation
- **THEN** 会话将 feedback 作为合成 user 注入并再调用模型至少一轮

#### Scenario: continue false 直接结束

- **WHEN** Stop 声明 `continue: false`
- **THEN** 不再进入模型轮次，本轮以已完成的 assistant 结果结束

#### Scenario: blocking 受 maxTurns 约束

- **WHEN** Stop 反复 blocking 请求续跑
- **THEN** 不得超过既有 maxTurns；触顶后按现有 max_turns 语义结束
