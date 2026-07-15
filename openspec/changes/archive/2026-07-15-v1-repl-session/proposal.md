## Why

v0 仅支持 headless 单次问答，用户无法在终端连续多轮对话；也缺少 claude-code 的 **L1 会话层**（QueryEngine + REPL）。v1 首要目标是让 Agent「能开着一个会话一直聊」，为后续 codebase 工具与 trace 调试提供承载面。

## What Changes

- 新增 `QueryEngine`：管理 `messages[]`、调用 `query()`、返回累积历史与 `Terminal`
- 新增 readline 交互 REPL：无参数启动时进入 `> ` 提示符循环
- 支持 slash 命令：`/exit`、`/clear`、`/help`
- 保留现有 headless 模式（`-- "问题"`、`-p` pipe）行为不变
- CLI 输出逻辑抽取为可复用函数，REPL 与 headless 共用

## Capabilities

### New Capabilities

- `query-engine`：`QueryEngine` 类/模块，封装单次 turn 的 `query()` 调用与消息累积
- `repl-session`：readline REPL 循环、slash 命令、多轮用户输入

### Modified Capabilities

- `cli-entrypoint`：无参数时进入 REPL；新增 `dev:repl` 或默认 REPL 启动路径

## Impact

- **新增**：`src/QueryEngine.ts`、`src/entrypoints/repl.ts`（或同级模块）
- **修改**：`src/entrypoints/cli.ts`（路由 headless vs REPL）、`package.json` scripts
- **文档**：`docs/architecture.md` L1 会话层、`src/query/CONTEXT.md`
- **不影响**：`query.ts` 核心循环、Provider 适配层、工具系统
