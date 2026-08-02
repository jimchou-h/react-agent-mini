## ADDED Requirements

### Requirement: Stop hook

系统 SHALL 支持在配置中声明 `Stop` hooks。当**顶层**（嵌套 depth = 0）`query` 以正常完成结束（模型不再发起 tool_use）时，SHALL 执行匹配的 Stop command hooks。`HOOKS=0` 或未配置时 SHALL 跳过。

#### Scenario: 顶层完成时执行 Stop

- **WHEN** depth=0 的 query 正常 completed，且配置含 Stop
- **THEN** 每个 Stop command 被调用一次（受超时约束）

#### Scenario: 子代理完成不跑 Stop

- **WHEN** 嵌套 depth≥1 的 query 完成
- **THEN** 不执行 Stop hooks

#### Scenario: HOOKS=0 跳过

- **WHEN** `HOOKS=0`
- **THEN** Stop 与 Pre/Post 均不执行

### Requirement: Stop exit 码与 JSON 协议

Stop command hooks SHALL 按以下精简协议解释结果（对齐 claude-code Stop）：

- exit **0**：成功；默认不强制续跑
- exit **2**：blocking — 以 stderr（若空则 stdout）作为 blocking feedback
- 其他非 0：非阻塞失败 — 不抛崩、不强制续跑
- stdout JSON 含 `continue: false`（可选 `stopReason`）：SHALL 设置 preventContinuation，优先于 exit 2 的续跑
- stdout JSON 含 `decision: "block"`（可选 `reason`）：SHALL 视为与 exit 2 同等的 blocking

#### Scenario: exit 2 产生 blocking

- **WHEN** Stop 以 exit code 2 结束且未声明 `continue: false`
- **THEN** 结果携带 blocking feedback（stderr 优先）

#### Scenario: continue false 阻止续跑

- **WHEN** Stop stdout JSON 声明 `continue: false`
- **THEN** 结果为 preventContinuation；即使同次为 exit 2 也不要求再进模型轮

#### Scenario: 其他非零 fail-soft

- **WHEN** Stop 以非 0 且非 2 的退出码结束，且未声明 `continue: false` / `decision: block`
- **THEN** 不抛崩会话；不强制续跑；本轮已完成的 assistant 结果仍有效
