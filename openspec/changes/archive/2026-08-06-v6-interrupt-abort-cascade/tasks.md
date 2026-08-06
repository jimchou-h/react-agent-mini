## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#94](https://github.com/jimchou-h/react-agent-mini/issues/94) query → callModel signal | 1.1–1.2 | — |
| [#95](https://github.com/jimchou-h/react-agent-mini/issues/95) QueryEngine + REPL SIGINT | 2.1–2.2 | #94 |
| [#96](https://github.com/jimchou-h/react-agent-mini/issues/96) Agent 级联 + 文档 | 3.1–3.2 | #95 |

## 1. query ↔ callModel signal

- [x] 1.1 `query` 调用 `callModel` 时传入 `abortController.signal`；abort 中映射为 `{ reason: 'aborted' }`（含 AbortError）
- [x] 1.2 单测：mock `callModel` 断言收到 signal；流中 abort 后 terminal 为 `aborted`

## 2. QueryEngine / REPL interrupt

- [x] 2.1 `QueryEngine` 暴露当前轮 abort（登记/清空 + `abortCurrentTurn` 或等价 API）
- [x] 2.2 REPL/CLI：turn 进行中第一次 SIGINT → abort 当前轮；空闲第一次不退出、窗口内第二次退出；收尾中第二次可强退；补单测（程序化 abort 为主）

## 3. 同步 Agent 级联与文档

- [x] 3.1 确认/补强 Agent 父 abort → 子停止的测试；必要时修级联边界
- [x] 3.2 README / 相关 CONTEXT：文档化 interrupt 语义与会话可继续
