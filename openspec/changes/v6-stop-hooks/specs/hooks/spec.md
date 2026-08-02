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

### Requirement: Stop 请求继续

Stop hook 可通过约定 stdout JSON 请求继续：`continue: true` 且可选 `message`。系统 SHALL 将 `message`（缺省时用简短默认文案）作为合成 user 注入并再进入模型轮次；该继续 SHALL 计入既有 maxTurns 限制。

#### Scenario: continue 再进一轮

- **WHEN** Stop stdout 声明 `continue: true` 与 `message`
- **THEN** 会话再调用模型至少一轮，且合成 user 对模型可见

#### Scenario: Stop 失败 fail-soft

- **WHEN** Stop 命令非零退出且未声明 continue
- **THEN** 不抛崩会话；本轮已完成的 assistant 结果仍有效
