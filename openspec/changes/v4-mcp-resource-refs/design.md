## Context

v4-mcp-capabilities 已实现：MCP slash 执行时先 `loadServerResourcesAsMetaMessages`（list + 全量 read），再注入 `prompts/get`。这保证了 tour demo「先读手册」可用，但：

1. claude-code 不会在 slash 前全量 `resources/read`；它靠 prompt 内嵌 `resource`、`@server:uri` 附件解析，或模型主动调 List/Read 工具。
2. 当前 tour prompt 只写自然语言「差旅手册（若已挂载）」，没有可解析的 MCP 引用，模型容易去工作区搜同名文件。

本设计在 mini 仓库内把 Host 主路径对齐到「显式 mention → 精确 read」，并把全量挂载降为无 mention 时的 fallback。

## Goals / Non-Goals

**Goals:**

- 从 prompt 注入文本中解析 `@server:uri`（与 claude-code mention 同形）
- 命中则只 `resources/read` 这些条目，作为 meta 消息插在 prompt 之前
- 无任何 mention 时 fallback：仍全量挂载该 slash 所属 server 的 Resources
- 更新 tour `plan_trip` 文案为显式 `@tour:docs://handbook`
- 单测覆盖：有引用只读命中项；无引用仍全量

**Non-Goals:**

- 删除 fallback 全量挂载（后续 change）
- 按中文资源名模糊匹配
- `@` 补全 UI、`list_changed`、subscribe
- 改变 List/Read 两工具的模型侧行为

## Decisions

### 1. 注入流水线顺序

**选择**：

1. `prompts/get` → `promptMessages`（meta）
2. 从 `promptMessages` 文本提取 `@server:uri`
3. 有引用 → `loadReferencedResourcesAsMetaMessages`
4. 无引用 → `loadServerResourcesAsMetaMessages(promptServerId)`（现有逻辑）
5. `injectBefore: [...resourceMessages, ...promptMessages]`

**理由**：必须先拿到 prompt 文本才能知道引用；资源仍先于开场白，保持「先材料、后指令」。

**备选**：先全量再按引用过滤——浪费 IO，否决。

### 2. Mention 语法

**选择**：`(^|\s)@([^\s]+:[^\s]+)`，再按**第一个** `:` 拆成 `server` + `uri`。

例：`@tour:docs://handbook` → `{ server: 'tour', uri: 'docs://handbook' }`。

**理由**：对齐 claude-code `extractMcpResourceMentions`；URI 内可含 `://`。

**备选**：允许省略 server、默认当前 slash server——便利但偏离 CC，本 change 不做。

### 3. 引用校验与错误

**选择**：

- 去重 `(server, uri)`
- server 未连接 / 无 resources / read 失败 → `warn`，跳过该条，不中断整个 slash
- 全部引用失败且无成功资源 → 仍注入 prompt（与 get 成功一致）；不额外 fallback 全量（避免「写了错误 @ 却悄悄塞全库」）

**理由**：显式引用失败应可见；fallback 只服务「完全没有 mention」的旧 prompt。

### 4. Demo 与 `.mcp.json` 约定

**选择**：tour server prompt 文案写死 `@tour:docs://handbook`；smoke / 文档约定 demo 的 mcp.json key 为 `tour`。

**理由**：server 进程不知道 Host 注册名；CC 同理要求 mention 带 server。仓库本地若仍用 `calc` 指向 tour，文档注明应改为 `tour` 或同步改文案。

### 5. 落位（对齐 architecture-alignment）

**选择**：解析与按需 read 放 `services/mcp/fetch.ts`；`repl.ts` 只编排「get → resolve resources → runTurn」。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 旧 prompt 无 `@` 依赖全量 | 保留 fallback |
| 写错 `@server` 导致手册未挂 | warn；模型仍可用 List/Read 工具 |
| demo key 不是 `tour` | README / `.mcp.json.example` 与 prompt 对齐 |
| 误把 `@` 当普通文本 | 语法要求空白后的 `@server:uri`，与 CC 一致 |

## Migration Plan

- 行为兼容：无 mention 的 MCP prompt 与今日相同
- 有 mention 的 prompt：从全量改为按需（**有意收窄**）
- tour demo 更新文案后，推荐 `.mcp.json` 使用 `"tour"` key

## Open Questions

- （已决）无 mention 时保留全量 fallback
- （已决）有 mention 但全部失败时不 fallback 全量
- （可后续）是否在 archive 后另开 change 删除 fallback
