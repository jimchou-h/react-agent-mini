## Why

复杂任务需要隔离上下文的子任务执行，而不污染主会话细节。claude-code 用嵌套 `query()` + `Agent` 工具实现子代理。mini 在 Memory / Stop 就绪后引入**最小同步子代理**，避免过早上 swarm / worktree。

## What Changes

- **`Agent` 工具**：必填 `description` + `prompt`；可选 `tool_names`；同步嵌套 `query()`，摘要回父 `tool_result`
- **派生上下文**：独立 messages；`AbortController` 链到父；`depth = parent + 1`（与 Stop 共用 depth 语义）
- **防递归**：默认 max depth 1；子工具池排除 `Agent`
- **权限**：派生自父 `canUseTool`（可更严 / 只读）
- **可观测**：TRACE `agent.start` / `agent.end`；失败 fail-soft 回父为错误 tool_result

**非目标**：

- `subagent_type` / 命名 agent 目录、Coordinator / swarm / 多 worker
- worktree、后台 fork、slash `context: fork`、teammate
- `SubagentStop`、完整 CC AgentTool 全字段与 resume UI

## Capabilities

### New Capabilities

- `subagents`: 同步嵌套 query 子代理工具与深度/权限边界

### Modified Capabilities

- `tool-system`: 注册 `Agent` 工具
- `query-engine` / `react-loop`: 嵌套 query 与统一 depth
- `permission-pipeline`: 子代理权限派生规则

## Impact

- **修改**：`query` / `QueryEngine` / `ToolUseContext`（depth、派生 abort）
- **新增**：`tools/AgentTool.ts`（或等价）
- **版本**：v6 三件套之一（Memory、Stop 已归档；本 change 随后）
- **依赖**：已归档的 Stop depth 语义；Memory 可选（子是否读 MEMORY 非硬阻塞）
