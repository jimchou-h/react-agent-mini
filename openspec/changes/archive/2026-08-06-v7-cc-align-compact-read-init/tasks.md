## Retro note

实现已在 `1408c3e` / `4139c00`；下列勾选表示整批已落地并已对照。

## 1. microcompact

- [x] 1.1 默认关闭出站 content-clear；`COMPACT_MICRO_CONTENT_CLEAR=1` / `microContentClear` 可开
- [x] 1.2 单测：默认不 clear；显式开启仍 clear 且保配对
- [x] 1.3 更新 `context-compact` / README / compact CONTEXT

## 2. Read readFileState

- [x] 2.1 `ToolUseContext.readFileState` + Read 命中返回 `FILE_UNCHANGED_STUB`
- [x] 2.2 单测覆盖同 path/range/mtime 去重与未命中重读
- [x] 2.3 更新 `tool-system` spec / tools CONTEXT

## 3. /init OLD_INIT

- [x] 3.1 引导正文对齐 CC `OLD_INIT_PROMPT`（目标文件名按策略替换）
- [x] 3.2 Host note：禁止 init 中跑全量测试 / 长 typecheck
- [x] 3.3 更新 `slash-init` spec / AGENTS / architecture-alignment
