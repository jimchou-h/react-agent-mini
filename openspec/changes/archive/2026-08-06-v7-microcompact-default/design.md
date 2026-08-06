## Context

- **状态**：retro。实现与 main spec 已在 `1408c3e`（`fix(compact): align microcompact and Read with CC`）合并。
- **CC 对照**：`microCompact.ts` legacy 路径已删；time-based MC 默认 `enabled: false`；cached MC 为 ant/cache-editing。外部默认 microcompact 为 no-op。

## Decisions

1. **默认 no-op**：`microcompactMessages` 仅在 `microContentClear` / `COMPACT_MICRO_CONTENT_CLEAR=1` 时做占位；否则原样返回。
2. **保留旧实现**：不删 apply 逻辑，方便对照与回归测试。
3. **压力路径**：出站压力继续由 tool_result budget、保尾、autocompact 承担（与 CC 外部默认一致）。
4. **不移植**：time-based / GrowthBook / cache editing（复杂度与依赖超出本仓当前范围）。

## Risks

- [长会话无 clear] → 依赖保尾 + autocompact；文档写明开关
- [履历缺失] → 本 change 补 OpenSpec archive 记录
