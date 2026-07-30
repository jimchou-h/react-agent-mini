## Context

主会话工具循环无法隔离「调研子任务」上下文。CC 嵌套 `query()`；mini 做深度 1 的同步 Agent 工具。

## Goals / Non-Goals

**Goals:** Agent 工具；嵌套 query；深度限制；权限派生；摘要回传。

**Non-Goals:** swarm、worktree、后台、多 worker、孙代理。

## Decisions

### 1. 触发

内置工具 `Agent`（名称可对齐 CC `Agent`）：入参至少 `prompt`（子任务说明）；可选 `tool_names` 子集。

### 2. 嵌套执行

- `createSubagentContext`：新 `AbortController` 链到父；`queryTracking.depth + 1`
- depth > max（默认 1）→ 立即错误 tool_result
- 子 `query()` 跑完收集最终 assistant 文本（或最后 N 字符）作为父 tool_result

### 3. 权限

默认复用父 `canUseTool`；可选子代理强制只读（配置 / 入参）。写操作仍走父确认策略。

### 4. Compact

子代理可共用 productionDeps；子会话独立 messages，不写回父历史（只回摘要）。

### 5. 落位

`tools/AgentTool.ts`；`ToolUseContext` 增 depth；`query` 识别嵌套。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 费用/延迟 | depth、工具子集、只读默认可后续加 |
| 权限绕过 | 派生同一 canUseTool，测 deny 透传 |

## Open Questions

- 工具对外名用 `Agent` 还是 `Subagent`：默认 `Agent` 对齐 CC
