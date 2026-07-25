## Context

stdio MCP Client 已能 list/call tools。SDK 同样支持 resources 与 prompts；mini 补最小 Host 路径，服务 blog 演示与 tour server。

## Goals / Non-Goals

**Goals:**

- 连接后若 server 声明 resources：可 list + read，内容进入模型可读通道
- 若声明 prompts：可 list + get，将消息注入当前 turn（推荐：作为额外 user/system 文本，不改 query 骨架）
- 失败 fail-soft（与 tools 一致）
- 示例 / smoke

**Non-Goals:**

- SSE/HTTP、OAuth、Sampling、Roots、Elicitation
- 完整资源订阅（resources/subscribe）

## Decisions

### 1. 暴露面

**选择**：内部 API `listMcpResources` / `readMcpResource` / `listMcpPrompts` / `getMcpPrompt`；再提供 1 个只读内置工具或 CLI 辅助（如启动时把 prompt 名写进帮助）。优先**只读 Tool** `McpResource`（name/uri）降低 CLI 面。

### 2. Prompt 注入

**选择**：`get` 得到的 messages 拼成文本块，作为**本轮** `systemPrompt` 追加或首条 user 前缀；文档写清。不做自动「每个 turn 都套 prompt」。

### 3. 与 mcp-client spec

**选择**：新 capability 文件 `mcp-resources` / `mcp-prompts`；`mcp-client` 仅 ADD「能力协商后可选启用」。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 大资源撑爆上下文 | read 截断上限；复用 compact |
| 工具过多 | 一个聚合 Tool + uri 参数 |

## Migration Plan

无 resources/prompts 的 server 行为与 v3 相同。

## Open Questions

- （倾向）用只读 Tool 暴露 resource read，便于 ReAct 演示
