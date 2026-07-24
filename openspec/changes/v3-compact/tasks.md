## 1. compact 纯函数

- [ ] 1.1 实现 `compactMessages`（tool_result 截断 + maxMessages）
- [ ] 1.2 单元测试：截断、保尾、关闭、无变更恒等

## 2. 接线

- [ ] 2.1 `QueryParams` 增加 compact 选项；读环境变量默认值
- [ ] 2.2 `queryLoop` 在 `callModel` 前应用；TRACE `compact.run`
- [ ] 2.3 确认 systemPrompt 不受影响

## 3. 文档与验收

- [ ] 3.1 更新 architecture / CONTEXT / README（`COMPACT=0`）
- [ ] 3.2 `bun run typecheck` 与 `bun test` 通过
- [ ] 3.3 集成或单测证明 callModel 入参被裁剪而 Engine 内存可选未改
