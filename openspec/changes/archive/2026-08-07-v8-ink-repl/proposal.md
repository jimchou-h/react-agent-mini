## Why

v7 已把引擎能力对齐到可学习的 CC 子集，但交互面仍是 readline，与 claude-code Ink REPL 差距最大。v8 改为 **方案 B**：vendor CC 的 `@anthropic/ink` fork，并按 CC 目录习惯裁剪接入 UI 壳——本层**不要求学习向**，优先观感与后续对齐；引擎仍保持本仓 `QueryEngine`。通过 **Host Bridge + 路径对齐 + stub 缺能力**，使后续跟随 CC 升级以「重拷 UI / 补 bridge」为主，而不是分叉重写。

## What Changes

- **Ink REPL 主界面**：消息 transcript（Markdown 渲染）+ PromptInput + 状态行 + 权限 Fallback + slash 建议。
- **Markdown（必须）**：助手/用户/流式文本经 `marked` GFM 子集渲染为终端 ANSI（对齐 CC marked 路线，便于后续换完整 Markdown.tsx）。
- **CC 对齐的 UI 树（裁剪）**：按 CC 相对路径落 `screens/REPL`、`components/Messages|PromptInput|permissions|…` 等；去掉或 stub 本仓没有的能力（plan、AskUserQuestion、sandbox、vim、图片 paste 等）。
- **Host Bridge（升级枢纽）**：薄适配层把本仓 `QueryEngine` / `AskFn` / slash / interrupt / ctx% 暴露为 UI 所需 props/事件；**禁止**为迁就 UI 而把业务逻辑写进大量 fork 过的 CC 组件内部。
- **权限 / slash / 流式 / interrupt**：行为对齐既有 v7 规格；交互走 CC 风格 PromptInput；权限 UI **能搬就搬**（Bash/FileEdit/FileWrite 等专用框优先，其余 Fallback）。
- **目录**：UI 根为 `src/ui/`（内部相对路径对齐 CC）。
- **headless / pipe**：不变，仍非 Ink。
- **BREAKING（仅 REPL 交互面）**：交互不再用 readline 主循环；依赖裸 stdout 流式的自动化改走 headless/`-p`。

## Capabilities

### New Capabilities

- `ink-repl`：基于 vendored `@anthropic/ink` 的 CC 对齐交互壳、Host Bridge、裁剪/stub 约定与升级策略

### Modified Capabilities

- `repl-session`：启动与会话环改为 Ink（CC 对齐壳）；Ink 消费 yields；slash/@uri/compact/ctx% 语义保持
- `cli-entrypoint`：无参启动进入 Ink REPL；headless/pipe 不变
- `turn-interrupt`：事件源改为 Ink/process；三段语义不变
- `permission-pipeline`：REPL 确认走 Ink 权限 UI（键位/语义保持 `y`/`n`/`a`）

## Impact

- 新增：`packages/@anthropic/ink`（或等价 workspace 路径）、`src/host/`（Bridge + stubs）、CC 风格 `src/components|screens|hooks`（可置于约定前缀下但**相对结构对齐 CC**）
- 改动：`src/entrypoints/cli.ts` 等装配；readline REPL 降为可选/移除
- 不动契约：`QueryEngine`、`query`、tools、MCP、compact（经 Bridge 接线）
- 文档：architecture / README；增加「从 CC 同步 UI」说明（design / 可选 ADR）
- 许可与来源：注明 UI/ink 源自 claude-code-best（或指定 upstream），记录 pin 的 commit/tag 便于迭代
