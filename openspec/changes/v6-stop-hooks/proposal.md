## Why

v5 已落 PreToolUse / PostToolUse，但轮次自然结束时仍无可配置扩展点。claude-code 的 Stop hook 用于审计收尾、强制继续或注入收尾指令；mini 需补齐这一生命周期面，完成 hooks 最小闭环。

## What Changes

- **Stop 事件**：当一轮 `query` 以「模型结束、无更多 tool_use」完成时，执行配置中的 Stop hooks
- **配置**：扩展既有 `.agents/hooks.json`（`Stop` 数组；command + 可选 timeout；matcher 可忽略或固定 `*`）
- **继续语义（精简）**：Stop 可用 exit / stdout JSON 请求「阻止结束并注入合成 user 再进一轮」；默认 fail-soft（hook 失败不阻断已完成回复展示）
- **可观测**：`TRACE=1` 时 stderr 输出 `hooks.stop`
- **`HOOKS=0`**：与 Pre/Post 一并跳过

**非目标**：

- SessionStart / SessionEnd / Agent / Compact 全家桶 hooks
- UI React hooks、完整 CC settings schema 兼容
- 与 Subagents 子 query 结束时强制跑父 Stop 的复杂合并策略（子结束是否跑 Stop：默认**仅顶层 query**）

## Capabilities

### New Capabilities

（无 — 落在既有 `hooks` 能力内）

### Modified Capabilities

- `hooks`: 增加 Stop 加载、匹配与执行
- `react-loop` / `query-engine`: 顶层完成路径调用 Stop；可选「continue」再进一轮
- `repl-session`：文档说明 Stop；示例 hook（可选）

## Impact

- **修改**：`services/hooks/*` 类型与 runner；`query` / `QueryEngine` 完成路径
- **配置**：`.agents/hooks.json` 增加 `Stop`
- **版本**：v6 三件套之一（建议在 Memory 后、Subagents 前或并行于 Memory）
