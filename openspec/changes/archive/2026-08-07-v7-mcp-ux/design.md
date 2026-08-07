## Context

MCP stdio 已接入。体验缺口在发现性与错误可读性。

## Goals / Non-Goals

**Goals:** help/list 更清晰；失败消息统一；可观测合并工具表。

**Non-Goals:** HTTP/SSE MCP、marketplace、OAuth 复杂流。

## Decisions

1. 增强 `/help` 与 MCP 相关提示，不新造平行命令体系（除非必要 `/mcp`）。
2. fetch/prompt 错误映射为稳定中文/英文可读句。
3. TRACE 或 stderr 状态保持低噪。

## Risks / Trade-offs

- [改动面散] → 按场景竖切 issue，避免大爆炸重构

## Open Questions

无。
