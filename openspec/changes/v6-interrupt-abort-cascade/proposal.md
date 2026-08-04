## Why

用户在 REPL 里按 Ctrl+C（或等价 interrupt）时，当前实现通常直接杀掉进程，而不是 abort 本轮 `query`。即便程序化调用了 `abortController.abort()`，`query` 也未把 `signal` 传给 `callModel`，进行中的模型流无法中止；同步 Agent 子会话虽已级联 abort，但缺少「用户 interrupt → 父轮 → 子 Agent → 流式 API」这条端到端契约。现在补齐后，interrupt 只结束本轮、会话可继续，行为对齐 Claude Code 的「先中断当前 turn」。

## What Changes

- REPL / CLI 在 Agent 运行中将第一次 interrupt（SIGINT 或等价）接到当前轮的 `AbortController.abort()`，**不**立即退出进程；本轮结束后可继续输入。
- `query` 调用 `callModel` 时传入 `abortController.signal`，使进行中的模型请求可被取消。
- 明确同步 Agent：父轮 abort 后子会话 MUST 停止（沿用现有独立 child controller + 级联；不改为共享同一 controller，除非实现证明等价）。
- 文档说明：第一次 interrupt 中断当前 turn；再次 interrupt / 空闲时的行为保持可预期（至少文档化）。

## Capabilities

### New Capabilities

- `turn-interrupt`: 用户 interrupt（Ctrl+C / SIGINT）如何映射到当前 turn 的 abort，以及会话是否可继续。

### Modified Capabilities

- `react-loop`: `query` 须将 abort signal 传入 `callModel`；abort 后本轮以 `aborted`（或既有等价）结束且历史仍配对。
- `tool-system`: 同步 Agent 在父 `abortController` abort 时，子会话 MUST 停止（级联要求写入需求）。

## Impact

- `QueryEngine` / REPL 入口：暴露或持有「当前轮 AbortController」，接线 SIGINT。
- `src/query.ts`：`callModel` 增加 `signal`。
- `src/services/api/client.ts`：已支持 `signal`，需确保被接通。
- `src/utils/subagent.ts` / `AgentTool`：验证级联；必要时补测试与文档。
- 无 **BREAKING** API；行为变化：Ctrl+C 从「杀进程」变为「先 abort 本轮」（空闲时二次退出策略在 design 中定）。
