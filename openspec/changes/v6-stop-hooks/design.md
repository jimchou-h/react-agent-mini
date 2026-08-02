## Context

v5 hooks 只覆盖工具前后。CC Stop 在模型 end_turn 时触发。mini 用既有 command hook 形态补 Stop。

## Goals / Non-Goals

**Goals:** Stop 配置与执行；顶层 query 完成时触发；可选阻止结束并注入合成 user；TRACE；`HOOKS=0`。

**Non-Goals:** Session\* / Compact / Agent hooks；子代理每层都跑 Stop（默认仅 depth=0）；复杂多轮 Stop 协商协议。

## Decisions

### 1. 触发点

在 `query`（或 `QueryEngine.runTurn`）判定 **completed**（assistant 无 tool_use / 正常结束）且 **depth === 0** 时调用 `runStopHooks`。`max_turns` / `aborted` / `model_error`：**默认不跑 Stop**（避免半残局二次编排；可在 Risks 注明）。

### 2. 配置

```json
{
  "Stop": [
    { "command": "node ./hooks/on-stop.mjs", "timeoutMs": 5000 }
  ]
}
```

`matcher` 对 Stop 可选；若存在则仅当匹配约定占位（如 `*`）时执行——实现可简化为「Stop 条目一律执行」。

### 3. Continue 语义

优先对齐精简 JSON stdout：

- `{ "continue": true, "message": "..." }` → 注入一条合成 user（或系统约定通道），再跑一轮模型（计入 maxTurns）
- 否则视为观测-only，不影响结束

exit code：非 0 默认 fail-soft（不 continue、不抛崩）；可选后续加 `blockOnFailure`（本 change 不做除非任务写明）。

### 4. 与子代理

嵌套 `query`（depth ≥ 1）**不**跑 Stop，避免子任务结束污染父编排。父轮在拿到 Agent tool_result 后若再 end_turn，才跑父 Stop。

### 5. 落位

- `services/hooks/types.ts`：`Stop` + payload
- `services/hooks/run.ts`：`runStop`
- `query.ts` / `QueryEngine`：completed 路径接线
- 单测：mock hook 观测调用次数；continue 再进一轮

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Stop continue 死循环 | 计入 maxTurns；单测覆盖 |
| 与 REPL 流式输出时序 | 先 flush 最终 assistant，再跑 Stop / 可能的第二轮 |
| RCE | 同 v5：仅信任 cwd 配置；`HOOKS=0` |

## Open Questions

- continue 注入用 user 还是 meta：默认 **user** 文本（模型可见），design 定稿如此
