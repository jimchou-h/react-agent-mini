## Why

v4 出站 compact 已有 budget + microcompact + 保尾，但超长会话仍靠丢弃早期轮次保尾，细节不可恢复。claude-code 在确定性层之后还有 **autocompact（LLM 摘要）**、手动 `/compact`，以及上下文占用百分比观测。本 change 在 v5 补齐这三者，完成 Context Budget 主线。

## What Changes

- **Autocompact**：出站规模超阈值时，用一次侧路 LLM 调用把较早历史压成摘要，写入会话（compact boundary + summary），后续出站以摘要 + 尾部为主
- **`/compact`**：REPL 手动触发同路径摘要压缩，并打印简短确认（可含压缩前后 ctx %）
- **上下文占用 %**：REPL 每轮结束后展示估算占用（优先最近一次 API `usage`；否则字符估算 ÷ 配置窗口）
- 更新 `context-compact` / `repl-session` 规格：去掉「不做 LLM 摘要」限制，增加 auto / manual / 观测要求

**非目标**：

- hooks、memory、子代理
- 精确 tokenizer、完整 status bar、成本美元
- reactive compact（API prompt-too-long 再压）、session memory compact、snip / contextCollapse
- PreCompact/PostCompact hooks

## Capabilities

### New Capabilities

（无 — 能力落在既有 compact / REPL 规格内）

### Modified Capabilities

- `context-compact`：增加 autocompact（LLM 摘要）、compact boundary；保留确定性层；增加占用 % 估算 API/观测约定
- `repl-session`：增加 `/compact`；每轮后展示 ctx %；`/help` 列出 `/compact`

## Impact

- **修改**：`services/compact/*`、`query/deps.ts`、`query.ts`、`QueryEngine.ts`、`entrypoints/repl.ts`、可能 `services/api/*`（读取 usage）
- **行为**：长会话可能自动摘要（额外一次模型调用）；`/compact` 会改写会话内存（与纯出站-only 的确定性层不同）
- **配置**：上下文窗口大小、autocompact 开关/阈值（环境变量）；`COMPACT=0` 仍关闭整条 compact 管道（含 auto）
