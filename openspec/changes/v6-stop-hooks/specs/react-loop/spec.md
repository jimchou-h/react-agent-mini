## ADDED Requirements

### Requirement: 完成路径调用 Stop

顶层 ReAct / query 循环在得出 **completed** 终止（无待执行 tool_use）后、向调用方返回之前，SHALL 调用 Stop hooks 流水线（若启用）。若 Stop 请求 continue，SHALL 在同一 `query`/`runTurn` 调用内尝试追加模型轮次，直至不再 continue 或触及 maxTurns。

#### Scenario: completed 后挂钩

- **WHEN** 模型返回纯文本且无 tool_use
- **THEN** 在返回 completed 前执行 Stop（若配置存在）

#### Scenario: continue 受 maxTurns 约束

- **WHEN** Stop 反复请求 continue
- **THEN** 不得超过既有 maxTurns；触顶后按现有 max_turns 语义结束
