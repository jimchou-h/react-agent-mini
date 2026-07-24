## Why

v2 已有 Skills（本地 Markdown 扩展），但扩展柱仍缺「外部协议工具」。MCP 是 claude-code 与 Cursor 生态的标准扩展面；在现有 `Tool` + `canUseTool` 上接入 stdio MCP，可验证「动态工具注册」而不改 `query()` 循环。

## What Changes

- 引入 MCP Client（stdio transport）：按配置启动/连接 server
- 将 MCP tools 适配为内部 `Tool`（JSON Schema → Zod 或宽松校验 + call 转发）
- 启动时合并 builtin + MCP tools 进入 `getTools()` / `ToolUseContext.tools`
- 复用现有 `canUseTool`（MCP 写类工具走同一套 REPL y/n / headless 策略）
- 配置：环境变量或 `.mcp.json`（见 design）
- 文档与示例（可用官方/简单 echo MCP server 做 smoke）

## Capabilities

### New Capabilities

- `mcp-client`：stdio MCP 连接、工具发现、调用转发与生命周期

### Modified Capabilities

- `tool-system`：工具列表可含动态 MCP 工具；命名防冲突

## Impact

- **新增依赖**：`@modelcontextprotocol/sdk`（或等价轻量 client）
- **新增**：`src/services/mcp/`（client、adapter）
- **修改**：CLI 启动接线、`ToolUseContext` 可选 mcp 句柄
- **非目标**：SSE/HTTP MCP、OAuth、MCP resources/prompts（可后续）、Agent 子任务
