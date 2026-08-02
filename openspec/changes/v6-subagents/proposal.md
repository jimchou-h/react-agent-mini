## Why

复杂任务需要隔离上下文的子任务执行，而不污染主会话细节。claude-code 用嵌套 `query()` + AgentTool 实现子代理。mini 在单会话 Context Budget 与 hooks 就绪后，再引入**最小同步子代理**，避免过早上 swarm / worktree。

## What Changes

- **`Agent` 工具**（或等价名）：主模型可派生子任务；子任务跑嵌套 `query()`，返回摘要文本给父会话
- **派生上下文**：子代理有独立 messages；权限派生自父（可更严）；工具子集可配置（默认与父相同或只读子集）
- **深度限制**：默认最大嵌套深度 1（禁止孙代理），防止递归爆炸
- **可观测**：TRACE / stderr 标明 `agent:*` 子运行；失败 fail-soft 回父为错误 tool_result

**非目标**：

- Coordinator / swarm / 多 worker 并行
- worktree 隔离、后台 fork、slash `context: fork`
- 完整 CC AgentTool 全字段与 resume UI

## Capabilities

### New Capabilities

- `subagents`: 同步嵌套 query 子代理工具与深度/权限边界

### Modified Capabilities

- `tool-system`: 注册 Agent 工具
- `query-engine` / `react-loop`: 支持嵌套 query 与 depth 记账
- `permission-pipeline`: 子代理权限派生规则

## Impact

- **修改**：`query` / `QueryEngine` / `ToolUseContext`（depth、派生 abort）
- **新增**：`tools/AgentTool`（或 `tools/Agent`）
- **版本**：v6 三件套之一（与 `v6-memory`、`v6-stop-hooks` 并行；建议在 Memory 之后实现）
- **依赖**：v5 已完成；`v6-memory` 可选增强（子代理是否读 MEMORY），非硬阻塞
