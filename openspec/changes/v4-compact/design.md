## Context

v3 `compactMessages`：每轮截断超长 tool_result + maxMessages 保尾，出站-only。问题是「未满也裁」与「裁掉对话骨架」。claude-code 有 microcompact / autocompact；mini 本 change 只做确定性阈值 + microcompact。

## Goals / Non-Goals

**Goals:**

- 估算出站字符量；低于阈值则只做（或跳过）轻量路径
- 超阈值：先 microcompact（旧 tool_result → 占位），仍超则沿用 v3 截断 + 保尾
- 占位文案明确「内容已清除，可重新读取/执行」
- 不破坏 tool_use / tool_result 配对
- TRACE 可区分策略

**Non-Goals:**

- LLM 摘要 autocompact
- 精确 tokenizer
- 写回 QueryEngine.messages（仍出站-only）

## Decisions

### 1. 阈值

**选择**：`COMPACT_THRESHOLD_CHARS`（默认如 80_000）或 `maxOutboundChars`；出站序列化近似和超过才跑 micro + 加重裁剪。低于阈值时：仍可对单条超长 tool_result 做 v3 硬截断（避免单条炸弹），但不做保尾丢轮。

### 2. microcompact 范围

**选择**：保留最近 K 轮完整 tool_result；更早的 tool_result 若 `content.length > N` 则替换为占位。K/N 可配置，默认保守。

### 3. 与 v3 关系

**选择**：扩展同一 `compactMessages`；`COMPACT=0` 全关。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 占位后模型迷路 | 占位含 path/工具名线索（若消息里有） |
| 阈值不准 | 字符近似；文档说明 |

## Migration Plan

默认行为对短会话接近 v3；长会话更少误伤。可用环境变量调阈值。

## Open Questions

- （已关闭）不做 LLM 摘要
- （已关闭）仍出站-only
