# mcp 模块术语表

stdio MCP 客户端与工具适配。源码：`src/services/mcp/`。

## 核心术语

| 术语 | 说明 |
|------|------|
| **`.mcp.json`** | 项目根配置；`MCP_CONFIG` 可覆盖路径 |
| **mcpServers** | server id → `{ command, args?, env? }` |
| **mcp__\<server\>__\<tool\>** | 合并进会话的公开工具名，避免覆盖 builtin |
| **adaptMcpTool** | MCP list_tools 条目 → 内部 `Tool` |
| **connectMcpSession** | stdio 连接、listTools、close |
| **loadMcpTools** | 启动时加载；无配置则空列表；失败 server 降级 |
| **sessionTools** | `getTools()` + MCP tools 合并 |

## 限制（v3）

- 仅 **stdio** transport
- 不支持 SSE/HTTP、OAuth、resources/prompts
- 默认 `isReadOnly=false`（走 canUseTool）；`readOnlyHint` 可映射为只读
