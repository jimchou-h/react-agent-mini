## Why

v5 已落 PreToolUse / PostToolUse，但轮次自然结束时仍无可配置扩展点。claude-code 的 Stop hook 用于审计收尾、以 exit 2 / blocking 强制模型再想一轮，或以 `continue: false` 阻止继续；mini 需补齐这一生命周期面，完成 hooks 最小闭环。

## What Changes

- **Stop 事件**：当一轮 `query` 以「模型结束、无更多 tool_use」完成时，执行配置中的 Stop hooks
- **配置**：扩展既有 `.agents/hooks.json`（`Stop` 数组；command + 可选 timeout；matcher 可忽略或固定 `*`）
- **协议（对齐 CC 精简）**：
  - **exit 0**：成功；默认结束本轮（stdout 不注入模型）
  - **exit 2**：blocking — 将 stderr（缺省则 stdout）格式化为 Stop feedback，作为合成 user 注入并再进模型轮次；计入 maxTurns；后续 Stop 调用携带 `stop_hook_active: true`
  - **其他非 0**：非阻塞失败 — 不抛崩、不强制续跑（fail-soft；可观测）
  - **stdout JSON `continue: false`**（可选 `stopReason`）：`preventContinuation` — 不再续跑，正常结束（优先于 exit 2 的续跑）
  - 可选：JSON `decision: "block"` + `reason` 等价于 exit 2 的 blocking 路径
- **可观测**：`TRACE=1` 时 stderr 输出 `hooks.stop`
- **`HOOKS=0`**：与 Pre/Post 一并跳过

**非目标**：

- SessionStart / SessionEnd / Agent / Compact / StopFailure 全家桶 hooks
- UI React hooks、完整 CC settings schema 兼容
- `SubagentStop`（子 query 结束默认**不**跑 Stop；仅顶层 depth=0）
- HTTP / prompt / agent 类型 Stop hooks（仅 command）

## Capabilities

### New Capabilities

（无 — 落在既有 `hooks` 能力内）

### Modified Capabilities

- `hooks`: 增加 Stop 加载、匹配与执行（exit 码与 JSON 协议）
- `react-loop` / `query-engine`: 顶层完成路径调用 Stop；blocking 再进一轮；`continue: false` 直接结束
- `repl-session`：文档说明 Stop；示例 hook（可选）

## Impact

- **修改**：`services/hooks/*` 类型与 runner；`query` / `QueryEngine` 完成路径
- **配置**：`.agents/hooks.json` 增加 `Stop`
- **版本**：v6 三件套之一（建议在 Memory 后、Subagents 前或并行于 Memory）
