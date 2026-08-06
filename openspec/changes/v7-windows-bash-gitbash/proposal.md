## Why

Windows 上 `Bash` 当前用 `cmd.exe` 执行命令，而模型（与 Claude Code）默认产出 Unix/bash 语法（`ls`、`&&`、`head`、`/dev/null`）。结果是大量「语法不识别」与中文 OEM 乱码。对齐 claude-code：Windows 上 Bash 走 **Git Bash**，并明确告知模型使用 Unix 语法。

## What Changes

- Windows 上 `BashTool` **不再**用 `ComSpec`/`cmd.exe`；改为解析并 spawn Git Bash（`bash.exe`）
- 支持环境变量覆盖（对齐 CC 语义：`CLAUDE_CODE_GIT_BASH_PATH` / 可识别的 `SHELL`）
- 找不到 Git Bash 时 **明确失败**（`isError` + 可操作提示），不静默退回 cmd
- 工具描述 / 系统上下文补充：Windows 仍用 Unix shell 语法
- 文档（README / tools CONTEXT）说明 Windows 依赖 Git for Windows

## Capabilities

### New Capabilities

（无 — 不新增独立能力域）

### Modified Capabilities

- `bash-tool`: Windows 执行器改为 Git Bash；缺 bash 时 fail-closed；向模型声明 Unix 语法

## Impact

- `src/tools/BashTool.ts` 及可能抽出的 `utils/windowsGitBash.ts`（或等价小模块）
- 单测：mock 路径解析 / 平台分支；非 win32 行为不变
- README / `src/tools/CONTEXT.md`
- **无 BREAKING API**（工具名仍为 `Bash`）；Windows 行为变化：从 cmd 方言 → bash 方言
- **非目标（本 change）**：独立 `PowerShell` 工具、完整 MSYS 路径转译层、OEM/GBK 自动转码、Bash 子进程细粒度 SIGINT（可后续票）
