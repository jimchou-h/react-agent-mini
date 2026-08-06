## Context

CC `WebSearch` 支持多 adapter；mini 用 DeepSeek 等兼容 API，无 Anthropic server-side search。采用客户端工具 + 外部 Search API。

## Goals / Non-Goals

**Goals:** 内置 `WebSearch`；单 adapter；标准结果；可测；可 abort。

**Non-Goals:** 多 adapter 热切换、Ink UI、`api` server-side、完整 CC 字段。

## Decisions

1. 工具名定稿 `WebSearch`；入参以 `query` 为主，可选 `allowed_domains` / `blocked_domains` / `num_results`。
2. 默认 adapter：优先 **Brave** 或 **Tavily**（实现时二选一写死默认，另一可后续 change）。
3. 缺 API Key → `is_error` 可读提示。
4. `isReadOnly() === true`；走现有 hooks。

## Risks / Trade-offs

- [API 费用/配额] → 默认结果数上限；文档说明
- [结果质量] → 单测用 mock adapter；集成测可选

## Open Questions

- 默认选 Brave 还是 Tavily：实现前确认 env 名即可，不阻塞 propose。
