## Context

v4-mcp-capabilities 曾在 slash 前全量 `resources/read`。claude-code 不会这样做。本 change 收敛为「显式 `@server:uri` → 精确 read」，且**不加** CC 没有的全量 fallback。

## Goals / Non-Goals

**Goals:**

- 解析 prompt 文本中的 `@server:uri`
- 仅对这些引用 `resources/read` 并 meta 注入（先于 prompt）
- 无 mention → 不自动挂 Resource
- tour `plan_trip` 使用 `@tour:docs://handbook`
- 单测：有引用只读命中；无引用返回空资源列表

**Non-Goals:**

- 无 mention 时全量挂载（CC 无；本仓库不对齐此项）
- 中文名模糊匹配、`@` 补全 UI、subscribe
- 改变 List/Read 两工具行为

## Decisions

### 1. 注入流水线

1. `prompts/get` → `promptMessages`
2. 提取 `@server:uri`
3. 有引用 → `loadReferencedResourcesAsMetaMessages`
4. 无引用 → `[]`（不全量挂载）
5. `injectBefore: [...resources, ...promptMessages]`

### 2. Mention 语法

`(^|\s)@([^\s]+:[^\s]+)`，首个 `:` 拆 `server` / `uri`。例：`@tour:docs://handbook`。

### 3. 错误

去重；server 缺失 / read 失败 → warn 跳过；不中断 slash；不因失败而改走全量挂载。

### 4. Demo

prompt 写死 `@tour:docs://handbook`；`.mcp.json` key 为 `tour`。

### 5. 落位

解析与按需 read 在 `services/mcp/fetch.ts`；`repl.ts` 只编排。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 旧 prompt 无 `@` 则材料不自动进上下文 | 要求 prompt 写明 `@server:uri`；模型仍可 List/Read |
| 写错 `@server` | warn；List/Read 可补救 |
| demo key 不是 `tour` | README / example 对齐 |

## Migration Plan

- **BREAKING（相对 v4-mcp-capabilities 全量挂载）**：无 `@server:uri` 的 MCP prompt 不再自动挂 Resources
- tour demo 已改文案；第三方 prompt 需自行加 mention 或依赖模型工具

## Open Questions

- （已决）不加全量 fallback，严格对齐 CC 按需路径
