## 1. trace 工具模块

- [x] 1.1 实现 `src/utils/trace.ts`（`trace()`、`isTraceEnabled()`）
- [x] 1.2 单元测试：TRACE 开/关行为

## 2. 埋点

- [x] 2.1 `cli.ts`：`cli.start`
- [x] 2.2 `query.ts`：`query.turn_start` / `query.turn_end`（含 terminal reason）
- [ ] 2.3 `client.ts` / `stream.ts`：`api.request` / `api.assistant` 摘要
- [ ] 2.4 `execution.ts`：`tool.start` / `tool.end`

## 3. 文档

- [ ] 3.1 更新或新增 `docs/learning/trace-flow.md`：stage 列表与示例输出
- [ ] 3.2 `docs/architecture.md` 增加 TRACE 小节

## 4. 验收

- [ ] 4.1 `bun run typecheck` 零错误
- [ ] 4.2 `bun test` 全通过
- [ ] 4.3 `TRACE=1 dev:mock -- "用 Echo 回复 hi"` 人工确认 stderr trace 顺序
