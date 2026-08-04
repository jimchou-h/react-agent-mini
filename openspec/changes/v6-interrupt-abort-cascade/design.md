## Context

`QueryEngine.runTurn` 每轮已创建独立 `AbortController`，权限拒绝会 `abort('user_reject')` 并结束本轮。同步 Agent 通过 `createSubagentContext` 使用**独立** child controller，并在父 abort 时级联。缺口在于：

1. REPL / CLI **未**将 SIGINT（Ctrl+C）接到该 controller；默认行为是进程退出。
2. `CallModelParams.signal` 已预留，但 `query` **未**传入；`client.ts` 支持 signal 却接不上。
3. 中止检查主要在 tool 循环边界；流式 `callModel` 期间用户 interrupt 无法立刻取消 HTTP/流。

对齐 Claude Code 精简目标：第一次 interrupt → abort 当前 turn（含进行中模型流与同步子 Agent）；会话保留，可继续输入。

## Goals / Non-Goals

**Goals:**

- 运行中第一次 interrupt → `abortController.abort('interrupt')`（或等价 reason）。
- `query` → `callModel` 传入 `signal`，流式请求可取消。
- 父轮 abort 后同步 Agent 子会话停止（现有级联写进需求并覆盖测试）。
- abort 后本轮返回 `{ reason: 'aborted' }`，消息配对规则不变；REPL 提示后可接受下一轮输入。

**Non-Goals:**

- 异步 / 后台 Agent、任务队列（本仓库无）。
- 完整复刻 CC 的 Escape 键、双 Ctrl+C 精细 UX（可做最小「空闲再 interrupt 则退出」）。
- 将 sync Agent 改为共享同一 `AbortController` 引用（级联已足够；不强制改成 CC 共享模型）。
- Bash 子进程的细粒度 SIGINT 转发（可选后续；本 change 以 query/Agent/API 为主）。

## Decisions

### D1：SIGINT 接线位置 — REPL / CLI 持有「当前轮 abort」句柄

- **选择**：`QueryEngine` 暴露只读 `getCurrentAbortController()`（或 `abortCurrentTurn(reason)`），`runTurn` 开始时登记、结束时清空；`runRepl` / `cli` 在 turn 进行中 `process.on('SIGINT', …)` 调用 abort。
- **替代**：在 `query` 内部监听 SIGINT → 拒绝（query 不应绑进程信号；headless/测试难测）。
- **空闲行为**：无进行中 turn 时，SIGINT 退出进程（或第二次确认退出）；文档写清。

### D2：`callModel` 接通 `signal`

- **选择**：`query` 每次 `deps.callModel({ …, signal: toolUseContext.abortController?.signal })`。
- Provider 已有 `{ signal }` 时透传；abort 后生成器结束，query 在边界检查 aborted 并 return `aborted`。
- **替代**：仅在 tool 边界检查 → 达不到「打断长流式输出」。

### D3：同步 Agent 保持独立 child + 级联

- **选择**：维持 `createSubagentContext` 现状；需求层要求「父 abort ⇒ 子 abort」。
- **替代**：共享父 controller（CC sync）→ 行为等价但改动测试与「子可独立 abort」语义；本 change 不改。

### D4：流中 abort 与消息配对

- **选择**：沿用现有 `react-loop` abort 配对要求；若 abort 发生在尚未产出完整 assistant/`tool_use` 时，不写入半截 tool_use；已 yield 的消息仍配对。
- Provider 层 abort 抛错或静默结束时，query 统一映射为 `aborted`（不把网络 abort 当 fatal crash）。

## Risks / Trade-offs

- [Windows Ctrl+C / readline 抢信号] → Mitigation：用 `rl.on('SIGINT')` 与/或 `process.on('SIGINT')` 实测；单测用程序化 `abort()` 覆盖核心路径，SIGINT 用薄集成或 mock。
- [abort 时 API 抛错冒泡] → Mitigation：query/callModel 消费路径捕获 AbortError，返回 `aborted`。
- [用户期望第二次 Ctrl+C 立刻杀进程] → Mitigation：turn 进行中 abort 后若仍卡住，允许第二次 SIGINT `process.exit`；design 实现时写清。

## Migration Plan

- 纯行为增强，无配置迁移。
- 文档（README / CONTEXT）补充 interrupt 语义。
- 回滚：去掉 SIGINT handler 与 signal 传参即可。

## Open Questions

- 无阻塞项。空闲 SIGINT：默认「直接退出」即可，若实现时 readline 行为特殊再微调。
