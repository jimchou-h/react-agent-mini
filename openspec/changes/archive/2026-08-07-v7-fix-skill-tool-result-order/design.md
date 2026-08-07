## Context

内部消息用 Anthropic 形态；出站经 `messagesToOpenAI` 转为 Chat Completions。OpenAI 硬性要求：含 `tool_calls` 的 assistant 之后，必须**立即**跟齐全部 `role:tool`（按 `tool_call_id`），中间不能夹普通 `role:user` 文本。

Skill 工具用 `prependMessages` 把 SKILL.md 正文注入会话。旧实现在 `orchestration.ts` 里先 yield 注入文本、再 yield `tool_result`，导致历史变成：

```
assistant(tool_calls)
user(text=Skill 正文)   ← 非法夹层
user(tool_result)
```

适配后即为 `assistant` → `user` → `tool`，触发 400。claude-code 则是 `addToolResult` 后再 push `newMessages`。

## Goals / Non-Goals

**Goals:**

- 编排层保证：任意 `tool_use` 的 `tool_result` 在注入正文之前进入历史
- 规格与回归测试锁住 OpenAI 配对顺序
- 注释澄清 `prependMessages` 实际是「tool_result 之后附加」

**Non-Goals:**

- 不重命名 `prependMessages` 字段（避免无关 churn）
- 不改 Skill 注入文案格式 / slash 路径
- 不做 Anthropic 官方 Messages API 直连（仍走 OpenAI 兼容层）
- 不自动修复已污染的会话历史（用户 `/clear`）

## Decisions

1. **在 orchestration 改顺序，不在 adapter 重排**
   - 方案 A：`messagesToOpenAI` 缓冲并重排 tool/user —— 能兜底，但掩盖内部历史错误，compact/调试更难
   - 方案 B（选中）：源头 yield `tool_result` 再 yield 注入 —— 与 CC 一致，历史自洽
   - 同消息内 adapter 已有「先 tool_result 块再 text」；本 bug 是**跨消息**夹层，单消息内排序救不了

2. **保留字段名 `prependMessages`**
   - 重命名为 `appendMessages` 更准，但触及 Tool 契约与多处注释；本 fix 只改编排顺序与文档语义

## Risks / Trade-offs

- [已污染会话仍 400] → 文档/回复提示 `/clear`；修复只影响新产生的轮次
- [Anthropic 官方 API 若将来直连] → 顺序同样正确（tool_result 须在下一 user 消息中，不宜被纯文本 user 隔开）

## Migration Plan

1. 合并代码后重启 REPL 或 `/clear`
2. 回滚：还原 `orchestration.ts` yield 顺序（会再次触发 Skill 后 400）

## Open Questions

（无）
