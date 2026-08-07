## Why

MCP 骨架已存在，但日常「列出 / 调用 / 失败可读」仍偏生。对齐 Claude Code「会话内真正可用」的方向，打磨体验而不扩展传输面。

## What Changes

- 改进 prompt/resource 列表与帮助展示
- 调用失败信息结构化、可读
- 会话工具表与 MCP 合并结果更可观测（slash/help/status）
- 文档补齐常用路径

## Capabilities

### New Capabilities

（无强制新 capability；或增量 `mcp-ux` 若需独立场景）

### Modified Capabilities

- `mcp-client` / `mcp-prompts` / `mcp-resources` / `repl-session`: 列表、错误、帮助体验

## Impact

- 主要改 `services/mcp/*` 与 REPL slash/help
- **不做** SSE/HTTP MCP、marketplace（保持既有非目标）
