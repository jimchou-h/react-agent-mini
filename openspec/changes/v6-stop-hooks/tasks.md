## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#88](https://github.com/jimchou-h/react-agent-mini/issues/88) observe-only Stop on completed | 1.1–1.3 | — |
| [#89](https://github.com/jimchou-h/react-agent-mini/issues/89) exit-2 blocking + continue:false | 2.1–2.2 | #88 |
| [#90](https://github.com/jimchou-h/react-agent-mini/issues/90) docs + example + verify | 3.1–3.2 | #89 |

## 1. Observe-only Stop（全路径）



- [ ] 1.1 扩展 hooks 类型与加载：`Stop` 数组 + 单测

- [ ] 1.2 实现 `runStop`：超时、exit 0/非2 非阻塞、结果形状；`HOOKS=0` / TRACE + 单测

- [ ] 1.3 顶层 completed 路径调用 Stop；depth≥1 跳过 + 单测



## 2. Blocking 续跑与 preventContinuation



- [ ] 2.1 exit 2 / `decision: block` → 注入 Stop feedback 合成 user 再进一轮；`stop_hook_active`；计入 maxTurns + 单测

- [ ] 2.2 stdout `continue: false` → preventContinuation，优先于 blocking，直接结束 + 单测



## 3. 文档与验收



- [ ] 3.1 README / hooks CONTEXT / 示例：CC 对齐的 exit 码与 JSON；去掉「本版不做 Stop」

- [ ] 3.2 `bun test` + typecheck；可选 `examples/hooks` Stop 演示（exit 2 或 continue false）

