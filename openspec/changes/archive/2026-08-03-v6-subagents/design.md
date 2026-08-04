## Context

主会话工具循环无法隔离「调研子任务」上下文。CC 用 `Agent` → `runAgent` → 嵌套 `query()`；mini 做**同步、深度 1** 的精简子集。Memory / Stop 已归档；本 change 接统一的 `depth` 记账（Stop 仅 `depth === 0`）。

## Goals / Non-Goals

**Goals:** 内置 `Agent`；嵌套 `query()`；depth 限制 + 子池排除 `Agent`；权限派生；摘要回传；与 Stop 的 depth 语义一致。

**Non-Goals:** `subagent_type` / 命名 agent 目录、swarm、worktree、后台 `run_in_background`、fork、teammate、`SubagentStop`、完整 CC AgentTool 字段与 resume UI。

## Decisions

### 1. 触发与入参（对齐 CC 精简）

工具名定稿 **`Agent`**（对齐 CC，不用 `Subagent`）。

| 字段 | 必填 | 说明 |
|------|------|------|
| `description` | 是 | 3–5 词短描述；用于 TRACE / 日志（对齐 CC；不参与子推理正文） |
| `prompt` | 是 | 子任务完整说明 → 子会话首条 user |
| `tool_names` | 否 | 工具名白名单；缺省 = 父工具表去掉 `Agent` 后的集合 |

不做：`subagent_type`、`model`、`run_in_background`、`isolation`、`name`/`team_name`。

### 2. 嵌套执行与 depth（与 Stop 统一）

- **单一计数**：`ToolUseContext.depth`（缺省 0）与 `query({ depth })` 使用同一语义：`0` = 顶层，`1` = 子代理。**禁止**另起 `queryTracking` 平行字段。
- `createSubagentContext(parent)`：
  - 新 `AbortController` 链到父（父 abort → 子 abort）
  - `depth: (parent.depth ?? 0) + 1`
  - 独立 `messages` 数组；`hooksConfig` / `hookExec` / `canUseTool` 派生自父（可收紧）
- 子调用：`query({ ..., depth: ctx.depth, toolUseContext: ctx })`
- **防递归双保险**（对齐 CC「子池去掉 Agent」+ mini depth cap）：
  1. 子工具列表 **SHALL 排除** `Agent`
  2. 若仍调用且 `depth > maxDepth`（默认 **1**）→ 不启动嵌套 query，立即错误 `tool_result`

### 3. 摘要回传

子 `query` 结束后：

1. 若 terminal 为 `aborted` / 未来 `model_error` 等失败 → 父 `tool_result` `is_error`
2. 成功：拼接子会话中**最后一条 assistant** 的全部 `text` 块（忽略 `tool_use`）；若超长则截断到预算（默认 32KB，尾部保留），前缀可选 `[Agent: {description}]`
3. 子中间 tool 轨迹 **不**写入父 `QueryEngine.messages`

### 4. 权限

默认复用父 `canUseTool`；可选入参 / 配置强制只读（过滤写类工具）。写操作仍走父确认策略。父 deny 对子 SHALL 生效。

### 5. Hooks / Stop

子 `query`（`depth ≥ 1`）**不**跑 Stop（已由 `v6-stop-hooks` 定稿）。本 change **不做** `SubagentStop`。

### 6. Compact

子共用 `productionDeps`；子会话独立 messages，不写回父历史。

### 7. 落位

- `tools/AgentTool.ts` + `getTools()` 注册
- `ToolUseContext.depth`；`createSubagentContext`（可放 `src/utils/` 或 `tools/`）
- TRACE：`agent.start` / `agent.end`（含 description、depth）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 费用/延迟 | maxDepth=1、排除递归 Agent、可选 tool_names、摘要截断 |
| 权限绕过 | 同一 canUseTool；单测 deny 透传 |
| depth 与 Stop 漂移 | 强制共用 `ToolUseContext.depth` / `query.depth` |

## Open Questions

（无 — 工具名定稿 `Agent`；协议按上表）
