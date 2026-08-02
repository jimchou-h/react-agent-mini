# Agent Memory

负责：加载 `.agents/memory/MEMORY.md`、预算截断、mtime 快照刷新、**始终注入**路径/remember 指引、ensure 目录。

不负责：session memory compact、云端 store、CC 式 topic 文件 + MEMORY.md 双步 index。

对齐 claude-code `memdir` 精简子集：`formatMemoryPromptSection` ≈ `buildMemoryLines`；`ensureMemoryDirExists` ≈ 同名 harness 行为。

## 路径与预算

| 项 | 值 |
|----|-----|
| 相对路径 | `.agents/memory/MEMORY.md` |
| 上限 | `MAX_MEMORY_BYTES`（32KB） |
| 缺失 | 启动成功；prompt 仍含空状态说明 |

## 注入

拼进 system prompt：**AGENTS/CLAUDE → Memory 段（指引 ± 正文）→ Skills 目录**。  
Memory 在 compact 管道之外（不替代 autocompact）。

## 刷新

`QueryEngine` 可选 `memoryRefresh`：每次 `runTurn` 前 `refreshMemorySnapshot`；mtime 未变复用缓存。

## REPL

`/memory` 只读展示路径与字符数，不 callModel。
