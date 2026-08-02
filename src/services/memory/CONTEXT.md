# Agent Memory

负责：加载 `.agents/memory/MEMORY.md`、预算截断、mtime 快照刷新。

不负责：session memory compact、云端 store、专用 Memory 工具（写入走既有 Write/Edit + 权限闸）。

## 路径与预算

| 项 | 值 |
|----|-----|
| 相对路径 | `.agents/memory/MEMORY.md` |
| 上限 | `MAX_MEMORY_BYTES`（32KB） |
| 缺失 | 静默跳过 |

## 注入

拼进 system prompt 的顺序：**AGENTS/CLAUDE → Memory → Skills 目录**。  
Memory 在 compact 管道之外（不替代 autocompact）。

## 刷新

`QueryEngine` 可选 `memoryRefresh`：每次 `runTurn` 前 `refreshMemorySnapshot`；mtime 未变复用缓存。

## REPL

`/memory` 只读展示路径与字符数，不 callModel。
