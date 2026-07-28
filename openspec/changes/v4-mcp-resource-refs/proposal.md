## Why

v4 MCP 能力已接上 Resources / Prompts，但 slash 执行前会**全量读取该 server 的全部 Resources** 再注入。这能兜住「prompt 只说先读差旅手册、模型却去项目里找文件」的问题，却偏离 claude-code 的按需策略，也会在资源变多时污染上下文。本 change 在 **v4** 内把主路径收敛为：解析 prompt 中的 `@server:uri`，只读取被引用的资源；无显式引用时再 fallback 全量挂载。

## What Changes

- **按引用注入**：从 `prompts/get` 返回文本中解析 `@server:uri`（对齐 claude-code mention 形态），对命中条目执行 `resources/read`，以 meta 消息注入当前 turn（先于 prompt 正文）
- **Fallback 保留**：prompt 文本中**无任何** `@server:uri` 时，仍按现行为全量挂载该 prompt 所属 server 的 Resources（避免旧 demo / 第三方 prompt 立刻回退）
- **Demo prompt 文案**：`examples/mcp-tour-server` 的 `plan_trip` 改为显式要求阅读 `@tour:docs://handbook`（不再只写「差旅手册（若已挂载）」）
- **文档 / 测试**：更新 MCP slash 注入顺序说明与单测（按引用只读一条；无引用仍全量）

**非目标**：

- 取消 `ListMcpResourcesTool` / `ReadMcpResourceTool`（模型仍可主动 list/read）
- `@` 自动补全 UI、资源热更新、`resources/subscribe`
- 启发式按中文名「差旅手册」模糊匹配资源
- 立刻删除 fallback（可作为后续 change）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `mcp-prompts`：slash / prompt 注入前的 Resource 挂载策略改为「优先按 `@server:uri`，否则 fallback 全量」
- `mcp-resources`：补充 Host 侧按 mention 解析并精确 `resources/read` 的要求
- `repl-session`：MCP slash 场景与挂载提示对齐新策略

## Impact

- **修改**：`src/services/mcp/fetch.ts`（解析 + 按需加载）、`src/entrypoints/repl.ts`（注入顺序）、`examples/mcp-tour-server/server.js`（prompt 文案）、相关单测与 MCP CONTEXT/README 说明
- **行为**：有 `@server:uri` 时不再默认塞入该 server 全部资源；无 mention 时行为与当前一致
