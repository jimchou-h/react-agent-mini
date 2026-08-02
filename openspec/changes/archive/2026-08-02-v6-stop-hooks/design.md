## Context

v5 hooks 只覆盖工具前后。CC Stop 在模型 end_turn 时触发，用 **exit 2 → blocking 续跑** 与 **`continue: false` → 阻止继续**。mini 用既有 command hook 形态对齐该精简协议。

## Goals / Non-Goals

**Goals:** Stop 配置与执行；顶层 query 完成时触发；exit 2 / `decision: block` 强制再进一轮；`continue: false` 阻止续跑；`stop_hook_active` 提示；TRACE；`HOOKS=0`。

**Non-Goals:** Session\* / Compact / Agent / StopFailure hooks；`SubagentStop`；HTTP/prompt hooks；复杂多 hook 协商以外的 CC 全量 schema。

## Decisions

### 1. 触发点

在 `query`（或 `QueryEngine.runTurn`）判定 **completed**（assistant 无 tool_use / 正常结束）且 **depth === 0** 时调用 `runStop`。`max_turns` / `aborted` / `model_error`：**默认不跑 Stop**（对齐 CC：错误路径走 StopFailure，本 change 不做）。

### 2. 配置

```json
{
  "Stop": [
    { "command": "node ./hooks/on-stop.mjs", "timeoutMs": 5000 }
  ]
}
```

`matcher` 对 Stop 可选；实现可简化为「Stop 条目一律执行」。stdin 可向 hook 提供 JSON（至少含 `hook_event_name: "Stop"`、`stop_hook_active`；字段可精简）。

### 3. 协议（对齐 CC）

处理优先级（与 CC `query.ts` 一致）：

1. **`preventContinuation`**（stdout JSON `continue: false`）→ 结束，不再进模型轮（reason 类比 `stop_hook_prevented`）
2. **blocking**（exit **2**，或 JSON `decision: "block"` + `reason`）→ 注入合成 user（文案前缀如 `Stop hook feedback:` + stderr/`reason`），同一 `query` 内再跑模型；计入 maxTurns；下一轮 Stop 的 `stop_hook_active === true`
3. **其他非 0** → fail-soft / 非阻塞：不续跑、不抛崩
4. **exit 0** 且无上述 JSON → 正常结束

**刻意不做 / 简化：**

- 不实现完整 `hookSpecificOutput` 树；Stop 只需上述字段
- 不实现 CC 的 UI summary attachment 全家桶；`TRACE=1` 足够

### 4. 与子代理

嵌套 `query`（depth ≥ 1）**不**跑 Stop。不做 `SubagentStop`。

### 5. 落位

- `services/hooks/types.ts`：`Stop` + hook 结果（`preventContinuation` / `blockingError`）
- `services/hooks/run.ts`：`runStop`
- `query.ts` / `QueryEngine`：completed 路径接线 + blocking 循环
- 单测：调用次数、exit 2 续跑、`continue: false`、maxTurns、`HOOKS=0`、depth≥1

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| exit 2 死循环 | maxTurns；`stop_hook_active` 供 hook 自停；单测 |
| 与 REPL 流式时序 | 先 flush 最终 assistant，再跑 Stop / 可能的第二轮 |
| RCE | 同 v5：仅信任 cwd 配置；`HOOKS=0` |

## Open Questions

（无 — 协议已按 CC 定稿；注入通道默认 **user** 文本，模型可见）
