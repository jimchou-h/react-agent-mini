# mcp 模块术语表

stdio MCP 客户端与工具适配。源码：`src/services/mcp/`。

## 核心术语

| 术语 | 说明 |
|------|------|
| **`.mcp.json`** | 项目根配置；`MCP_CONFIG` 可覆盖（逗号分隔多文件，后者覆盖同名 server） |
| **mcpServers** | server id → `{ command, args?, env? }` |
| **mcp__\<server\>__\<tool\>** | 合并进会话的公开工具名，避免覆盖 builtin |
| **adaptMcpTool** | MCP list_tools 条目 → 内部 `Tool`；透传 `isError`；image 块省略 base64 |
| **connectMcpSession** | stdio 连接、listTools、capabilities、commands、close |
| **loadMcpTools** | 启动时加载；无配置则空列表；失败 server 降级 |
| **sessionTools** | `getTools()` + MCP tools +（有 resources 时）`ListMcpResourcesTool` / `ReadMcpResourceTool` |
| **fetchResourcesForClient** | `resources/list`；无 capability / 失败 → `[]` |
| **fetchCommandsForClient** | `prompts/list` → REPL slash 命令元数据 |
| **`@server:uri`** | Prompt 文本中的资源引用（如 `@tour:docs://handbook`） |
| **resolvePromptResourceMessages** | 有 `@server:uri` → 按需 read；无引用 → fallback 全量挂载该 prompt 所属 server |
| **MCP slash** | REPL `/server:prompt args` → `prompts/get` → resolve resources → meta 注入当前 turn |

## Resource 工具（对齐 claude-code）

| 工具 | 入参 | 说明 |
|------|------|------|
| **ListMcpResourcesTool** | 可选 `server` | 列出 MCP 资源 |
| **ReadMcpResourceTool** | `server`, `uri` | 读取资源；blob 不进 context |

任一 connected server 声明 `resources` 时，会话工具表全局追加上述两工具一次。

## Prompts（REPL only）

- 用户面：`/<server>:<prompt> (MCP) [args…]`
- 内部名：`mcp__<normalizedServer>__<prompt>`
- Host 挂载：优先解析 prompt 内 `@server:uri`；无 mention 时 fallback 全量挂载该 server
- **不经 SkillTool**；headless/pipe 不自动执行 MCP slash

## 限制

- 仅 **stdio** transport
- 不支持 SSE/HTTP、OAuth、Sampling、`resources/subscribe`
- 默认 `isReadOnly=false`（走 canUseTool）；`readOnlyHint` 可映射为只读
- image content 不入模型上下文（仅占位提示）

## 演示

`examples/mcp-tour-server/` 同时暴露 tools / resources / prompts；demo 的 `.mcp.json` key 应为 **`tour`**（与 prompt 中 `@tour:docs://handbook` 一致）。`node examples/mcp-tour-server/smoke.mjs` 可单独验 server。
