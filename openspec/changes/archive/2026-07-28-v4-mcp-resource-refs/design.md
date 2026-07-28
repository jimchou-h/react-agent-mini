## Context

v4-mcp-capabilities 曾在 slash 前全量 `resources/read`。claude-code 不会这样做。本 change 收敛为「显式 `@server:uri` → 精确 read」，且**不加** CC 没有的全量 fallback。另：CC 在**普通用户输入**也会解析 `@server:uri`（`getAttachmentMessages`）；mini 曾只在 MCP slash 路径处理，本 change 一并补齐。

## Goals / Non-Goals

**Goals:**

- 解析文本中的 `@server:uri`（slash prompt 结果 + 普通用户消息 + headless prompt）
- 仅对这些引用 `resources/read` 并 meta 注入（先于用户/prompt 正文）
- 无 mention → 不自动挂 Resource
- tour `plan_trip` 使用 `@tour:docs://handbook`
- 单测覆盖 slash / 普通 REPL 两条路径

**Non-Goals:**

- 无 mention 时全量挂载
- 中文名模糊匹配、`@` 补全 UI、subscribe
- 改变 List/Read 两工具行为

## Decisions

### 1. Slash 注入流水线

1. `prompts/get` → `promptMessages`
2. 从文本提取 `@server:uri` → 按需 read
3. `injectBefore: [...resources, ...promptMessages]`（无 userText）

### 2. 普通消息 / headless

1. 从用户原文提取 `@server:uri` → 按需 read
2. 资源 meta 在前，用户原文仍作为本轮 user（`runTurn(text, { injectBefore: resources })` 或 headless 拼 messages）
3. 对齐 CC：mention 附件 + 用户原文并存

### 3. Mention 语法

`(^|\s)@([^\s]+:[^\s]+)`，首个 `:` 拆 `server` / `uri`。

### 4. 错误

去重；失败 warn 跳过；不中断回合；不因失败改走全量挂载。

### 5. 落位

`resolvePromptResourceMessages`（对任意含文本的 user 消息列表）在 `services/mcp/fetch.ts`；`repl.ts` / `cli.ts` 编排。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 用户消息无 `@` 则不自动挂材料 | 与 CC 一致；可用 List/Read |
| 写错 `@server` | warn |

## Migration Plan

- 相对「仅 slash 全量挂载」：**BREAKING** 为无 mention 不再全量挂
- 新增普通消息 mention → 行为更接近 CC（additive）

## Open Questions

- （已决）普通消息也解析 `@server:uri`
- （已决）不加全量 fallback
