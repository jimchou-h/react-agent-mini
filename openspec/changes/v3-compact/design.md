## Context

claude-code 有 microcompact / autocompact；mini 只做**确定性裁剪**，保证可测、无额外 LLM 费用。

## Goals / Non-Goals

**Goals:**

- 按「保留最近 K 条 user 消息及其后文」或「总消息数上限」裁剪
- 对更早的 `tool_result` 内容截断到 `maxToolResultChars`（保留头尾提示已截断）
- `query` 每轮 callModel 前对**发送副本** compact（可选：写回 QueryEngine.messages 或仅出站）
- 默认开启温和阈值；可用环境变量关闭

**Non-Goals:**

- 调用模型做摘要
- 精确 tokenizer
- 按工具类型的精细 budget（可后续）

## Decisions

### 1. 作用点

**选择**：在 `queryLoop` 调用 `deps.callModel` 前：`const outbound = compactMessages(messages, opts)`，**不修改** state.messages（出站-only）。

**理由**：会话内存仍完整，便于 `/clear` 外的调试；避免 compact 不可逆丢历史。若消息极大导致内存问题，后续可加「写回」模式。

**备选**：写回 Engine.messages — 更省内存，但不可逆；v3 文档标明为后续选项。

### 2. 策略

**选择**（两级）：

1. 所有 `tool_result` 块若 `content.length > maxToolResultChars`（默认 4000），截断
2. 若消息条数 > `maxMessages`（默认 40），从最早的非最近上下文成对删除旧消息，保留最近完整 turns

### 3. systemPrompt

不受 compact 影响（仍每次单独传入）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 裁掉关键早期约束 | 保留最近 K turn；文档提示重要约束放 AGENTS.md |
| 出站-only 内存仍涨 | README 说明长会话可 `/clear`；后续写回模式 |

## Migration Plan

默认 compact 开启但阈值保守；`COMPACT=0` 关闭。

## Open Questions

- （已关闭）出站-only 为首版策略
