## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#74](https://github.com/jimchou-h/react-agent-mini/issues/74) Context usage % + REPL | 1.1–1.2, 4.2 | — |
| [#75](https://github.com/jimchou-h/react-agent-mini/issues/75) LLM compact + `/compact` | 2.1, 2.3, 4.1 | #74 |
| [#76](https://github.com/jimchou-h/react-agent-mini/issues/76) Autocompact in query + docs | 2.2, 3.1–3.2, 5.1–5.2 | #75 |

## 1. 上下文占用估算

- [x] 1.1 实现 `estimateContextUsage`（usage 优先，否则字符≈token ÷ `CONTEXT_WINDOW_TOKENS`）+ 单测
- [x] 1.2 暴露格式化辅助（如 `ctx ~42%`）供 REPL / TRACE 复用

## 2. LLM compact 核心

- [ ] 2.1 实现 `compactConversation`：侧路无工具摘要、compact boundary、保留尾部、写回消息列表；失败不改写 + 单测（stub 摘要）
- [ ] 2.2 实现 `autoCompactIfNeeded`：阈值判定、`AUTOCOMPACT=0`、连续失败熔断；`COMPACT=0` 整条关闭 + 单测
- [ ] 2.3 `QueryEngine.compactNow()`（或等价）封装写回 `#messages`，供 slash / 自动路径共用

## 3. query 管道接线

- [ ] 3.1 `QueryDeps` 增加 `autocompact`；`query` 在确定性层后调用；mock 模式用假摘要
- [ ] 3.2 单测：超阈值触发写回；失败回退且会话不变；`AUTOCOMPACT=0` 不触发

## 4. REPL：`/compact` + ctx %

- [ ] 4.1 注册 `/compact`：调用 `compactNow`，打印前后占用 %；失败可读错误；`/help` 列出
- [x] 4.2 每轮结束后打印 `ctx ~NN%` + 单测（slash 与 onAfterTurn）

## 5. 文档与验收

- [ ] 5.1 更新 README / compact CONTEXT：autocompact、`/compact`、`AUTOCOMPACT`、`CONTEXT_WINDOW_TOKENS`、占用 %
- [ ] 5.2 `bun test` + typecheck；手动或 mock：长会话自动摘要、`/compact`、ctx % 可见
