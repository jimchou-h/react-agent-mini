## Why

Claude Code 已移除「出站超阈值 → 旧 tool_result content-clear」的 legacy microcompact；外部默认靠单条截断、保尾与 autocompact。本仓曾默认启用 content-clear，导致模型重读已清内容、与 CC 行为不一致。本 change **回溯记录**已在 `1408c3e` 落地的默认关闭策略，便于 OpenSpec 履历检索。

## What Changes

- **BREAKING（行为）**：默认不再在出站超阈值时将旧 COMPACTABLE `tool_result` 替换为 `[Old tool result content cleared]`
- 显式逃生口：`microContentClear` 或 `COMPACT_MICRO_CONTENT_CLEAR=1` 可恢复旧占位行为
- `DEFAULT_MICRO_KEEP_RECENT` 对齐 CC time-based 默认值 `5`（仅显式开启 content-clear 时生效）
- README / CONTEXT 文档化默认与开关

**非目标（本 change 不记录为范围）：** CC time-based / cached microcompact；同提交中的 Read `readFileState` 去重（属工具层，另见实现提交）。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `context-compact`：microcompact 默认 SHALL NOT content-clear；显式启用时保留旧占位语义

## Impact

- 已实现：`src/services/compact/compact.ts`、单测、`openspec/specs/context-compact/spec.md`（`1408c3e`）
- 本 change 为 **retro / 履历**：代码与 main specs 已对齐，归档时可不重复 sync specs
