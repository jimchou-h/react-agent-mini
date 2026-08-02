# hooks Specification

## Purpose

用户可配置的工具生命周期钩子（PreToolUse / PostToolUse / Stop）：从工作区加载配置，在权限通过后、`Tool.call` 前后执行命令型 hook，并在顶层 query 正常完成时执行 Stop。

## Requirements

### Requirement: Hook 配置加载

系统 SHALL 能从工作区约定配置文件加载 hooks 定义（工具匹配规则 + 可执行动作）。配置缺失或 `HOOKS=0` 时 SHALL 跳过所有 hooks 且不影响工具执行。

#### Scenario: 无配置时跳过

- **WHEN** 工作区无 hooks 配置或 hooks 禁用
- **THEN** 工具执行路径与无 hooks 时一致

#### Scenario: 加载合法配置

- **WHEN** 配置文件声明某工具的 PreToolUse / PostToolUse
- **THEN** Host 在会话启动或首次工具调用前可解析到对应 hooks

### Requirement: PreToolUse / PostToolUse

系统 SHALL 在权限通过后、工具 `call` 前执行匹配的 PreToolUse；在 `call` 成功或失败后执行匹配的 PostToolUse。PreToolUse 明确 deny 时 SHALL 不调用 `call`，并向模型返回错误 `tool_result`。

#### Scenario: PreToolUse 放行后执行工具

- **WHEN** PreToolUse 成功且未 deny
- **THEN** 正常执行 `Tool.call` 并继续 PostToolUse

#### Scenario: PreToolUse deny

- **WHEN** PreToolUse 返回 deny（或配置为失败即 deny）
- **THEN** 不执行工具，返回 is_error 的 tool_result

#### Scenario: PostToolUse 失败不撤销结果

- **WHEN** 工具已执行且 PostToolUse 失败
- **THEN** 已产生的 tool_result 仍回注模型；记录警告

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
