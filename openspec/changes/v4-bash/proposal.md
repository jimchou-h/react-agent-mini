## Why

v3 已有 Read / Write / Edit / MCP，但没有 shell，Agent 仍无法跑测试、装依赖、看进程输出——「读—改」缺最后一环「跑」。对齐 claude-code `BashTool` 的精简子集，在现有写权限柱上接入 `Bash`，形成可演示的 coding 闭环，并适合写成系列下一篇 blog（钩子：Agent 终于有终端）。

## What Changes

- 新增 `Bash` 工具：`command`（必填）、可选 `timeout_ms` / `description`
- 在 `cwd` 下执行；捕获 stdout/stderr；超时强制终止；输出超限截断
- `isReadOnly` → false，复用 `canUseTool`（REPL y/n；headless 需 `ALLOW_WRITE=1`）
- 注册 `getTools()`；CLI 状态行与权限确认摘要
- 文档 + 单测 / smoke；proposal 注明 blog 角度（见下）

## Capabilities

### New Capabilities

- `bash-tool`：受控 shell 命令执行（超时、输出截断、cwd 绑定）

### Modified Capabilities

- `tool-system`：注册 Bash；工具表含 Bash
- `permission-pipeline`：写权限确认摘要支持 Bash（命令预览）

## Impact

- **新增**：`src/tools/BashTool.ts`（或等价）
- **修改**：`getTools()`、`cliHelpers`、`canUseTool` 摘要、README / architecture / CONTEXT
- **非目标**：交互式 TTY、后台常驻进程、完整命令白名单引擎、沙箱隔离（容器/seccomp）、跨平台 PowerShell 专用语法封装
- **依赖**：Node/Bun 子进程 API；无新 npm 包（优先）

## Blog 角度（写作约束）

本 change 必须能独立成篇，结构对齐既有系列（权限+Write / MCP 接线）：

| 要素 | 内容 |
|------|------|
| 钩子 | 「读得了、改得了，还跑不了」→ Bash 补上「跑」 |
| 隐喻 | 终端是借来的钥匙；门卫（canUseTool）仍要问一句 |
| 演示 | `bun test` / `echo` 一类无破坏命令；拒绝路径对照 |
| 刻意不做 | 完整沙箱、交互式 shell、always-allow 记忆 — 留给后续篇 |

实现与文档措辞应服务上述叙事，避免只堆安全 checklist。
