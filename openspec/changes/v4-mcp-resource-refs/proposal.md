## Why

v4 MCP slash 曾在执行前**全量读取**该 server 的 Resources。这偏离 claude-code：CC 只按 prompt 内嵌 resource、`@server:uri`，或模型主动 List/Read 拉材料。本 change 在 **v4** 内改为仅解析并挂载 `@server:uri` 引用，与 CC 同方向。

## What Changes

- **按引用注入**：从 `prompts/get` 返回文本解析 `@server:uri`，对命中条目 `resources/read`，以 meta 消息注入当前 turn（先于 prompt 正文）
- **无全量兜底**：无任何 `@server:uri` 时，Host **不**自动挂载该 server 的 Resources（对齐 CC；模型仍可用 List/Read 工具）
- **Demo prompt**：`plan_trip` 显式写 `@tour:docs://handbook`
- **文档 / 测试**：说明按引用挂载；无引用则不自动挂载

**非目标**：

- 取消 `ListMcpResourcesTool` / `ReadMcpResourceTool`
- `@` 自动补全 UI、`resources/subscribe`
- 按中文名模糊匹配资源
- Host 侧「无 mention 全量挂载」兼容层（**刻意不做**，因 CC 无此行为）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `mcp-prompts`：slash 注入前仅按 `@server:uri` 挂载 Resource
- `mcp-resources`：Host 侧 mention 解析与精确 read
- `repl-session`：MCP slash 挂载行为对齐按需策略

## Impact

- **修改**：`src/services/mcp/fetch.ts`、`src/entrypoints/repl.ts`、tour demo、CONTEXT/README、单测
- **行为**：仅当 prompt 含 `@server:uri` 时 Host 自动挂材料；否则只注入 prompt 正文
