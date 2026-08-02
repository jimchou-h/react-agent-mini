## Context

v4 已在 `services/compact` + `query` 出站管道实现确定性裁剪（budget → microcompact → retainTail），且 **出站-only**（不写回 `QueryEngine.messages`）。claude-code 在其后还有 autocompact（LLM 摘要）与手动 `/compact`；摘要后会话以 compact boundary 为界，API 只看摘要之后的消息。本 change 对齐该方向的最小可运行子集。

## Goals / Non-Goals

**Goals:**

- 阈值触发的 LLM 摘要（autocompact），失败 fail-soft 回退到既有确定性层
- REPL `/compact` 走同一摘要路径，并写回会话内存
- 上下文占用 %（估算或 API usage）在 REPL 可观测
- `deps` 可注入 autocompact，单测可 mock

**Non-Goals:**

- hooks / memory / 子代理
- 精确 tokenizer、成本统计、完整 status bar
- reactive compact、session memory compact、snip、contextCollapse
- PreCompact/PostCompact hooks

## Decisions

### 1. 管道位置

在既有确定性管道之后（或与阈值判定并列）加入 `deps.autocompact`：

```
applyToolResultBudget → microcompact → [autocompact?] → retainTail（兜底）
```

- **自动路径**：仅当估算占用 ≥ autocompact 阈值，且未连续失败熔断时调用。
- **成功后**：写回会话内存（与纯出站 micro 不同）——用摘要 + 保留尾段替换较早历史，并插入 compact boundary 标记，避免重复摘要同一段。
- **失败**：记录警告，不改会话；本轮继续用确定性出站裁剪。

Alternatives: 只改出站不写回 → 每轮重复摘要浪费；拒绝，对齐 CC「boundary 之后才是活历史」。

### 2. 摘要如何调用模型

- 侧路一次非流式（或短流式）`callModel` / 专用 `summarizeMessages`，**不带工具**，prompt 为「总结此前对话要点，便于继续任务」。
- 注入 `QueryDeps.autocompact`（或 `summarizeForCompact`），测试可 stub 固定摘要字符串。
- Mock 模式（`QUERY_MOCK=1`）：可用确定性假摘要，避免真 Key。

### 3. 手动 `/compact` vs 自动

| | 自动 | `/compact` |
|--|------|------------|
| 触发 | 出站/占用超阈值 | 用户 slash |
| 写回会话 | 是 | 是 |
| 阈值 | 需要 | 可强制（短会话也可压） |
| 反馈 | TRACE + 可选一行 | REPL 打印确认 + ctx % |

共享 `compactConversation(messages, { force })` 一类核心函数。

### 4. 上下文占用 %

- `estimateContextUsage(messages | usage) → { usedPercent, source }`
- 优先：最近一次 API `usage` 的 input（+ cache 若有）÷ `CONTEXT_WINDOW_TOKENS`（环境变量，缺省如 128000）
- 回退：`estimateOutboundChars` / 4 近似 token ÷ 窗口
- REPL：`onAfterTurn` 或 turn 结束后打印 `ctx ~NN%`；`/compact` 打印前后对比
- headless：默认不刷屏；`TRACE=1` 可打

### 5. 与 `COMPACT=0`

- `COMPACT=0`：关闭 budget / micro / retainTail / autocompact 全部。
- 可选更细：`AUTOCOMPACT=0` 只关自动，仍允许 `/compact`（建议做，便于演示手动路径）。

### 6. 落位

- `services/compact/autoCompact.ts`（或同目录拆分）：阈值、摘要编排、boundary
- `services/compact/contextUsage.ts`：占用 % 估算
- `query/deps.ts`：增加 `autocompact`
- `QueryEngine`：暴露 `compactNow()` 供 REPL 调用并写回 `#messages`
- `repl.ts`：注册 `/compact`，turn 后打印 ctx %

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 摘要丢细节导致后续答错 | 保留最近 N 条完整消息；摘要 prompt 强调决策/路径/未决问题 |
| 额外 API 费用与延迟 | 阈值 + 连续失败熔断（如 3 次）；`AUTOCOMPACT=0` |
| 写回与出站-only 语义混用 | 文档区分：确定性层仍出站-only；LLM compact 改会话 |
| usage 缺失导致 % 不准 | 标明 `~` 估算；有 usage 再切换 |

## Migration Plan

- 默认行为：长会话可能多一次摘要调用（additive）
- 可用 `AUTOCOMPACT=0` 或 `COMPACT=0` 回退到 v4 行为
- 无数据迁移

## Open Questions

- （已决）不进 hooks / memory / 子代理
- （已决）ctx % 用估算优先、usage 增强
- 摘要是否保留 systemPrompt 一并送给侧路模型：实现时默认带上当前 session systemPrompt
