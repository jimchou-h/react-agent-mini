## Why

对齐 Claude Code 时发现：legacy 出站 content-clear 已移除、Read 有 `readFileState` 去重、`/init` 正文应对齐 `OLD_INIT_PROMPT`。本仓曾默认 clear 旧 tool_result，且 Read 无去重，导致模型重复读文件。本 change **回溯记录**提交 `1408c3e`（及紧随的 `4139c00` host note）整批落地内容，供 OpenSpec 履历检索。

## What Changes

### 1. microcompact 默认关闭 content-clear

- **BREAKING（行为）**：默认不再在出站超阈值时将旧 COMPACTABLE `tool_result` 换成 `[Old tool result content cleared]`
- 逃生口：`microContentClear` / `COMPACT_MICRO_CONTENT_CLEAR=1`
- `DEFAULT_MICRO_KEEP_RECENT=5`（仅显式开启时生效）

### 2. Read `readFileState` 去重

- `ToolUseContext.readFileState`：同路径 + 同 offset/limit 且 mtime 未变时返回 `FILE_UNCHANGED_STUB`（对齐 CC）
- 成功 Read 后写入 state（`fromRead: true`）

### 3. `/init` 对齐 CC `OLD_INIT_PROMPT`

- 引导正文照搬 OLD_INIT（仅替换目标文件 `AGENTS.md` / `CLAUDE.md`）
- Host note：禁止 `/init` 中执行全量测试 / 长 typecheck（`4139c00`）
- NEW_INIT（AskUserQuestion 等）明确非目标

### 文档

- README / CONTEXT / `AGENTS.md` / `architecture-alignment.md` 同步说明

**非目标：** CC time-based / cached microcompact；NEW_INIT 访谈 UI。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `context-compact`：microcompact 默认 SHALL NOT content-clear
- `tool-system`：Read 增加 `readFileState` 去重 stub 语义
- `slash-init`：引导正文对齐 OLD_INIT；host note 约束

## Impact

- 实现提交：`1408c3e`、`4139c00`
- 本 change 为 **retro / 履历**；main specs 在本修订中补齐 Read / slash-init 缺口
