## Context

CC `WebSearch` 支持多 adapter；mini 用 DeepSeek 等兼容 API，无 Anthropic server-side search。采用客户端工具 + 外部 Search API。

## Goals / Non-Goals

**Goals:** 内置 `WebSearch`；Brave + Tavily 双 adapter（env 选择）；标准结果；可测；可 abort。

**Non-Goals:** Ink UI、`/web-tools` 面板、`api` server-side、完整 CC 字段、运行时热切换 UI。

## Decisions

1. 工具名定稿 `WebSearch`；入参以 `query` 为主，可选 `allowed_domains` / `blocked_domains` / `num_results`。
2. Adapter：`brave`（`BRAVE_API_KEY`）与 `tavily`（`TAVILY_API_KEY`）；`WEB_SEARCH_ADAPTER` 可强制；未设且仅有 Tavily Key → tavily，否则默认 brave。
3. 缺 API Key → `is_error` 可读提示。
4. `isReadOnly() === true`；走现有 hooks。

## Risks / Trade-offs

- [API 费用/配额] → 默认结果数上限；文档说明
- [结果质量] → 单测用 mock adapter；集成测可选

## Open Questions

- （已关闭）默认选 Brave；有 Tavily Key 时可自动切 Tavily。
