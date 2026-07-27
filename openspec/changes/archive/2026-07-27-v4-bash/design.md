## Context

claude-code `BashTool` 功能面很宽（安全规则、后台任务、sed 解析等）。mini 只做**可学习的最小终端**：在 cwd 起子进程、限时、截断输出，权限复用 v2 `canUseTool`。读者 blog 只需理解「借来的钥匙 + 门卫」，不讲完整沙箱。

## Goals / Non-Goals

**Goals:**

- `Bash({ command, timeout_ms?, description? })`
- 工作目录固定为 `process.cwd()`（不接受任意 cwd 逃逸）
- 默认超时（如 30s），可配置上限封顶（如 120s）
- 合并 stdout/stderr 或分栏返回；总输出超限截断并注明
- 非零退出码 → `tool_result` 标错或明确失败文案（仍返回已捕获输出，便于模型调试）
- `isReadOnly=false`；REPL / headless 与 Write/Edit 同策略
- CLI 状态行与确认摘要含命令短预览

**Non-Goals:**

- 交互式 TTY / PTY、stdin 管道喂多行密码
- 后台常驻（`&` 托管、进程组会话）
- 完整危险命令静态分析引擎（可做极简拒绝列表作可选增强）
- Windows 专用 PowerShell wrapper；用系统默认 shell（Windows 上可用 `cmd`/`powershell` 由实现选定并文档说明）
- 网络/文件系统沙箱

## Decisions

### 1. 执行后端

**选择**：`Bun.spawn` / `node:child_process` spawn，**不**经 `shell: true` 拼接不可信字符串以外的额外层——`command` 本身就是用户/模型给出的 shell 行，需文档标明「等价于在项目目录开终端敲一行」。

**备选**：强制 `execFile` 无 shell → 无法管道/`&&`，demo 与 blog 体验差，否决。

### 2. Shell 选择

**选择**：

| 平台 | shell |
|------|--------|
| Win32 | `process.env.ComSpec` 或 `cmd.exe`，`/c` |
| 其他 | `process.env.SHELL` 或 `/bin/bash`，`-lc` |

**理由**：跨平台可讲清；blog 用 `echo` / `bun test` 即可。

### 3. 超时与输出

**选择**：

- 默认 `timeout_ms = 30_000`；入参可覆盖，硬顶 `120_000`
- 超时 → kill 进程树（尽力），返回可读超时错误 + 已有输出
- 输出合并为单一字符串返回模型；超过 `MAX_BASH_OUTPUT_CHARS`（如 50_000）截断并附提示

### 4. 权限摘要

**选择**：确认文案形如 `允许 Bash 执行「bun test」（最多 30s）？[y/N]`；命令过长截断预览。

### 5. 极简危险模式（可选 v4.0 内）

**选择**：首版**不做**黑名单，避免假安全感；README 写明「与本机终端同等风险，靠 canUseTool + 人审」。若单测成本低，可后续加 `rm -rf /` 等超硬规则为增强，不阻塞 MVP。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 模型跑破坏性命令 | canUseTool；blog/文档强调人审；headless 默认 deny |
| 挂起进程 | 超时 + kill |
| 输出炸上下文 | 截断 + compact 已存在 |
| Windows / Unix 行为差 | 文档注明 shell；单测用跨平台命令 |

## Migration Plan

仅新增工具；无 `.mcp.json` 时行为与 v3 一致。`ALLOW_WRITE=1` 语义扩展为「允许写类工具含 Bash」。

## Open Questions

- （已关闭）首版不做命令黑名单
- （已关闭）blog 角度写入 proposal，实现不另开叙事 change
