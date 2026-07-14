## Why

v0 仅有 Echo 与 Read，Agent 无法高效探索代码库（搜索内容、按模式找文件）。Read 也不支持分段读取大文件。v1 第二 slice 补齐 **只读代码库工具**，在 auto-allow 前提下让 Agent 能完成「找文件 → 读文件 → 回答」类任务。

## What Changes

- 新增 **Grep** 工具：基于 Bun 内置或子进程 `rg`/正则，在 cwd 内搜索
- 新增 **Glob** 工具：按 glob 模式列举 cwd 内文件
- 增强 **Read** 工具：支持 `offset` + `limit` 分段读取
- 注册到 `getTools()`，更新 adapter 出站 schema
- CLI 工具状态行支持 Grep/Glob

## Capabilities

### New Capabilities

- `grep-tool`：正则/文本搜索，路径限制在 cwd，结果条数上限
- `glob-tool`：glob 模式匹配文件列表，结果数量上限

### Modified Capabilities

- `tool-system`：Read 工具增加 offset/limit；工具注册表包含 Grep、Glob

## Impact

- **新增**：`src/tools/GrepTool.ts`、`src/tools/GlobTool.ts`
- **修改**：`src/tools/ReadTool.ts`、`src/tools/index.ts`、`cliHelpers.ts`
- **依赖**：优先 Bun `Glob`/`$` shell rg；无 rg 时可用纯 JS 回退（design 详述）
- **Blocked by**：无硬依赖；与 REPL 可并行，但验收场景在 REPL 中更自然
