## Why

v4 MCP slash 曾在执行前**全量读取**该 server 的 Resources。这偏离 claude-code：CC 只按 prompt 内嵌 resource、`@server:uri`，或模型主动 List/Read 拉材料。本 change 在 **v4** 内改为仅解析并挂载 `@server:uri` 引用，与 CC 同方向；并补齐 **普通用户消息**（非 slash）中的 `@server:uri` 解析注入——此前 mini 只在 MCP slash 路径处理，与真实 Claude Code 不一致。

## What Changes

- **按引用注入（slash）**：从 `prompts/get` 返回文本解析 `@server:uri`，对命中条目 `resources/read`，以 meta 消息注入当前 turn（先于 prompt 正文）
- **按引用注入（普通消息）**：REPL / headless 用户原文中的 `@server:uri` 同样解析并挂载，再发送用户原文（对齐 CC `getAttachmentMessages`）
- **无全量兜底**：无任何 `@server:uri` 时，Host **不**自动挂载该 server 的 Resources
- **Demo prompt**：`plan_trip` 显式写 `@tour:docs://handbook`
- **文档 / 测试**：slash + 普通消息两条路径均有覆盖

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
- `mcp-resources`：Host 侧 mention 解析与精确 read（slash + 普通输入）
- `repl-session`：普通消息与 MCP slash 均支持 `@server:uri` 按需挂载
- `cli-entrypoint`（若行为写入 headless）：headless/pipe 用户 prompt 中的 `@server:uri` 同样挂载

## Impact

- **修改**：`src/services/mcp/fetch.ts`、`src/entrypoints/repl.ts`、`src/entrypoints/cli.ts`（headless）、tour demo、CONTEXT/README、单测
- **行为**：用户或 prompt 文本含 `@server:uri` 时 Host 自动挂材料；否则不自动挂
