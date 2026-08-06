## Retro note

实现与 main specs 已在提交 `1408c3e` 完成；下列任务勾选表示「已落地并已对照」，非待开发。

## 1. 行为与规格

- [x] 1.1 默认关闭出站 content-clear microcompact；`COMPACT_MICRO_CONTENT_CLEAR=1` / `microContentClear` 可开
- [x] 1.2 单测：默认不 clear；显式开启仍 clear 且保配对
- [x] 1.3 更新 `openspec/specs/context-compact`、README、`services/compact/CONTEXT.md`
