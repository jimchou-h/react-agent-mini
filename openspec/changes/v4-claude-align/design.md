## Context

react-agent-mini 刻意保持 claude-code 同构模块边界，但 v0–v4 实现时多处采用了简化 schema（`path`、`timeout_ms`）与不同默认（Grep 返回行、Skill ID 用 frontmatter name）。上游模型与提示词普遍按 claude-code 契约训练，漂移会导致 Zod 校验失败或策略分叉。本 change 做**契约对齐**，不扩大功能面。

## Goals / Non-Goals

**Goals:**

- 内置文件类工具统一 `file_path` 入参（Read / Write / Edit）
- Bash 使用 `timeout`；默认 120s
- Grep 默认 `files_with_matches`，`head_limit` 默认 250，支持 `output_mode`
- Read 文本结果带行号；`offset` 允许 0
- Write 自动 `mkdir`；Edit CRLF/空白匹配（原 `v4-edit-polish`）
- Skill 调用 ID = 目录名；可选 `args`；注入 meta + 短 tool_result
- 权限拒绝文案对齐 `REJECT_MESSAGE` 英文语义
- MCP 工具名 `normalizeNameForMCP`
- compact 仅清理 COMPACTABLE 工具结果，path 线索读 `file_path`

**Non-Goals:**

- `path` 长期双字段兼容（仅 Bash `timeout` 可短期别名）
- readFileState / stale 检查、Bash 沙箱、后台任务、LLM autocompact
- 完整 project memory 树、`~/.claude/skills`、插件 skills
- Resources/Prompts MCP（留给 `v4-mcp-capabilities`）

## Decisions

### 1. 文件路径字段：一次性改为 `file_path`

**选择**：Zod schema 仅接受 `file_path`；内部 `resolvePathUnderCwd` 等 helper 参数同步改名。

**备选**：同时接受 `path` 与 `file_path` — 拒绝，会长期维持双契约。

### 2. Bash `timeout` 与兼容

**选择**：schema 主字段 `timeout`；解析层若收到 `timeout_ms` 则映射到 `timeout` 并打 TRACE 弃用提示（单测覆盖），下一小版本可删别名。

**默认**：120_000 ms，与 claude-code `getDefaultBashTimeoutMs` 对齐；硬顶仍 120s 或提升至 600s — **选 600s 硬顶** 对齐 claude `getMaxTimeoutMs`，默认仍 120s。

### 3. Grep `output_mode`

**选择**：实现三模式；默认 `files_with_matches`。content 模式保留现有 JS 遍历实现；不引入 rg 二进制依赖。

**默认 head_limit**：250；`0` 表示不限（与 claude 一致，文档警告慎用）。

### 4. Read 行号

**选择**：文本 Read 始终 `addLineNumbers`：默认 `offset=1`，`offset=0` 视为 1；格式 `N→line`（与 claude 默认 tab 形态二选一 — **用 `\t` 分隔** 对齐 `addLineNumbers`）。

### 5. Edit 匹配（吸收 v4-edit-polish）

**选择**：读入 CRLF→LF 视图匹配；写回时若原文件含 CRLF 则恢复 CRLF。精确失败且去行尾空白后唯一命中则替换。不实现空 `old_string` 建文件。

### 6. Skill ID 与注入

**选择**：

- `discover.ts`：`name` 字段 = 目录名；frontmatter `name` → `displayName`（仅 system 摘要展示）
- `Skill` tool：参数 `skill` + 可选 `args`（字符串，透传替换正文占位或前缀说明）
- 执行时：向 messages 注入一条 user/meta 风格消息承载技能正文（实现上等价 assistant 不可见通道 — **用 query 层追加 ephemeral user content** 或 tool 执行前 hook）；`tool_result` 返回 `Launching skill: <name>` 类短文案

**备选**：继续全文 tool_result — 拒绝，与 claude 训练分布不一致。

### 7. REJECT_MESSAGE

**选择**：`USER_REJECT_MESSAGE` 改为 claude-code `REJECT_MESSAGE` 英文原文（或常量 re-export 同文案）。headless deny 文案可保留中文（非模型可见路径）或统一英文 — **模型可见的 deny message 一律英文**。

### 8. MCP normalize

**选择**：在 `adapter.ts` 构建公开名时对 serverId 与 toolName 做 `normalizeNameForMCP`：`replace(/[.\s]/g, '_')`（与 claude 同源逻辑精简版）。

### 9. compact COMPACTABLE

**选择**：常量表对齐 claude 子集：`Read`, `Bash`, `Grep`, `Glob`, `Edit`, `Write`（及 `mcp__*` 前缀工具按原名判断）。占位英文：`[Old tool result content cleared]`；path 线索从 `tool_use.input.file_path` 读取。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| **BREAKING** 已有测试/脚本用 `path` | 全量改测试；README 示例同步 |
| Grep 默认变文件列表，旧用例期望行内容 | 单测与 smoke 显式传 `output_mode: 'content'` |
| Skill 目录名与 frontmatter name 不一致的旧仓库 | 文档说明；摘要展示 displayName、调用用目录名 |
| Skill 注入改 messages 形状 | 单测覆盖 query 循环不破坏 tool 配对 |

## Migration Plan

1. 先改 schema + 测试（红）
2. 权限摘要、compact path 线索同 PR
3. 更新 README / CONTEXT / architecture 示例
4. `v4-edit-polish` 标记 superseded，不再单独实施
5. `bun test` + `bun run typecheck` 全绿后归档

## Open Questions

- （已关闭）Bash 硬顶 600s — 采用
- （已关闭）Read 行号分隔符 — 采用 `\t`
