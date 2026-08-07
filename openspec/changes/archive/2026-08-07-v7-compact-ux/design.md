## Context

已有 budget / micro / retain / autocompact。用户难理解何时触发。

## Goals / Non-Goals

**Goals:** 压缩反馈可读；关键展示占用；文档对齐行为。

**Non-Goals:** 重写策略树、向量召回、跨会话记忆 compact。

## Decisions

1. `/compact` 与 autocompact 成功路径打印 before→after（已有则加强一致性）。
2. 可选轻量 `/status` 或扩展现有 ctx 行。
3. TRACE 事件保持稳定字段名。

## Risks / Trade-offs

- [噪声] → 仅在实质压缩时打印

## Open Questions

`/status` 是否单独立 change：可并入本 change 最小实现。
