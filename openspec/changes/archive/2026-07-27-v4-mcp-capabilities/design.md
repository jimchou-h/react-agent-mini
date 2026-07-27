## Context

stdio MCP Client 已能 list/call tools。claude-code 在 Host 侧对 resources 用 **两个只读内置工具**，对 prompts 用 **slash command + meta 注入**。mini 在 stdio + 无 Ink 前提下对齐该形态，服务 blog 与 tour server。

## Goals / Non-Goals

**Goals:**

- 连接后读取 server capabilities；resources / prompts 按能力门控
- Resources：`fetchResourcesForClient`（fail-soft `[]`）+ `ReadMcpResourceTool`（硬错误）
- 任一 server 有 resources → 会话工具表追加 `ListMcpResourcesTool`、`ReadMcpResourceTool`（全局去重一次）
- Prompts：`fetchCommandsForClient` → REPL slash；`prompts/get` 结果注入 meta 消息
- 大文本 / blob 不进 context（截断或路径占位，对齐 CC 10 万字符量级）
- 示例 smoke + 单测

**Non-Goals:**

- SSE/HTTP、OAuth、Sampling、Roots、Elicitation、`resources/subscribe`
- `@server:uri` 附件、`prompts/list_changed` / `resources/list_changed` 热更新
- MCP skills（`skill://`）、Prompt 经 SkillTool 或 systemPrompt 自动追加

## Decisions

### 1. Resources 暴露面（对齐 CC）

**选择**：内部 API `fetchResourcesForClient(client)`、`readMcpResource(server, uri)`；模型侧两个只读内置工具：

| 工具 | 入参 | 行为 |
|------|------|------|
| `ListMcpResourcesTool` | 可选 `server` | 列出全部或指定 server 的资源；每项含 `uri`、`name`、`mimeType?`、`description?`、`server` |
| `ReadMcpResourceTool` | `server`, `uri` | `resources/read`；text 返回正文；blob 落盘或占位路径，**不把 base64 写入 tool_result** |

- list：`fetchResourcesForClient` 无 capability / 失败 → `[]`（不拖垮会话）
- read：server 不存在、未连接、无 resources 能力 → **抛错** → `tool_result` is_error
- 单条结果上限：`maxResultSizeChars` ≈ 100_000；超出截断并说明
- 注入时机：`connectMcpSession` 完成后，若任一 server `capabilities.resources` → 合并两工具（与 CC `resourceToolsAdded` 同语义）

### 2. Prompt 注入（对齐 CC slash，不对齐 system 追加）

**选择**：

1. `fetchCommandsForClient`：`prompts/list` → 内部 `McpSlashCommand[]`
2. 命名：
   - 内部：`mcp__` + `normalizeNameForMCP(server)` + `__` + `prompt.name`
   - 用户面（slash 输入）：`${server}:${prompt.name} (MCP)`（空格会破坏解析，故用 programmatic name）
3. REPL：`/help` 列出 MCP 命令；用户输入 `/myserver:greet (MCP) arg1 arg2`
4. 执行：`prompts/get`，args 按空格拆分后与 `prompt.arguments[].name` zip 对齐
5. 注入：`get` 返回的 messages 转为文本/content blocks，作为 **meta user 消息**（或等价 `isMeta` 通道）进入**当前 turn** 的 query，**不**写入持久 systemPrompt
6. **刻意不做**：SkillTool 合并 MCP prompts；无 slash 的 headless 自动 prompt 注入

### 3. Client 与 session 状态

**选择**：

- `connectOneServer` 后：`capabilities = client.getServerCapabilities() ?? {}`
- `McpSession` 扩展：`tools` + `resourcesByServer?` + `commands?` + `clients`（connected server 句柄，供工具/slash 查找）
- `loadMcpTools` / CLI REPL 读取 `commands` 合并进 slash 表
- 仅 tools 的 server：行为与 v3 完全一致

### 4. Spec 拆分

**选择**：`mcp-resources`、`mcp-prompts` 新建；`mcp-client` MODIFIED（能力协商 + 动态注入）；`repl-session` MODIFIED（MCP slash）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 大 resource 撑爆上下文 | 100k 截断；blob 落盘；compact 仍可裁剪 tool_result |
| 工具表膨胀 | resource 工具全局只加 2 个，不 per-server 复制 |
| headless 无 slash | 文档标明 MCP prompts 仅 REPL；headless 仍可用 resource 工具 |
| REPL slash 解析 `(MCP)` | 复用 CC 约定：第二 token 为 `(MCP)` 标记 |

## Migration Plan

无 resources/prompts 能力的 server 与 v3 相同。已有 `.mcp.json` 无需变更。

## Open Questions

- （已决）Resource 用两工具，不用单工具 `McpResource`
- （已决）Prompt 走 slash，不走 systemPrompt 追加
