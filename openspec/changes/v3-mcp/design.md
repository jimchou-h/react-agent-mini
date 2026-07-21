## Context

claude-code 通过 MCP 动态加载外部 tools。mini 只做 **stdio** 单/多 server，工具适配进现有 `Tool` 契约，权限复用 v2 `canUseTool`。

## Goals / Non-Goals

**Goals:**

- 配置驱动连接 ≥1 个 stdio MCP server
- `list_tools` → 适配为 `Tool[]`，合并进会话工具表
- `call_tool` 经 `tool.call()` 转发；错误变为 `tool_result` is_error
- 命名：`mcp__<server>__<tool>` 或等价前缀，避免与 builtin 冲突
- 进程退出时关闭 MCP 连接

**Non-Goals:**

- SSE/Streamable HTTP、OAuth、采样（sampling）
- MCP resources / prompts 完整支持
- 热重载 servers（可后续 `/mcp` slash）

## Decisions

### 1. SDK

**选择**：官方 `@modelcontextprotocol/sdk` + StdioClientTransport。

**理由**：协议细节多，自研 JSON-RPC 不值得；与生态一致。

### 2. 配置格式

**选择**：项目根 `.mcp.json`（claude-code 风格子集）：

```json
{
  "mcpServers": {
    "demo": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  }
}
```

无文件则跳过 MCP（零开销）。环境变量 `MCP_CONFIG` 可覆盖路径。

### 3. Schema 适配

**选择**：MCP inputSchema（JSON Schema）→ 运行时用宽松对象校验（或 `z.record` + 服务端校验）；`call` 把 args 原样传给 MCP。

**理由**：完整 JSON Schema→Zod 转换复杂；MCP server 仍会校验。

### 4. isReadOnly

**选择**：默认 `false`（稳妥，走权限确认）；若 MCP annotations 标明 readOnly，可映射为 true（可选增强）。

### 5. 启动时机

**选择**：CLI 启动与 `loadSessionContext` 并行连接；失败则 stderr 警告并继续（仅 builtin tools）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| MCP server 挂起 | 连接/调用 timeout |
| 工具名过长 | 前缀规范 + 截断描述 |
| Windows npx 路径 | 文档注明；smoke 用本地 fixture server |

## Migration Plan

无 `.mcp.json` 时行为与 v2 完全一致。

## Open Questions

- （已关闭）配置用 `.mcp.json`
- resources/prompts → v3.1+
