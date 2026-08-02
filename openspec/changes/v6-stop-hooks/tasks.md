## Issue map

（拆票后填写）

## 1. Stop 运行时

- [ ] 1.1 扩展 hooks 类型与加载：`Stop` 数组 + 单测
- [ ] 1.2 实现 `runStop`（超时、fail-soft、解析 continue JSON）+ 单测

## 2. Query 接线

- [ ] 2.1 顶层 completed 路径调用 Stop；depth≥1 跳过 + 单测
- [ ] 2.2 continue → 合成 user 再进一轮；计入 maxTurns + 单测

## 3. 文档与验收

- [ ] 3.1 README / hooks CONTEXT / 示例：Stop 配置与安全说明；去掉「本版不做 Stop」
- [ ] 3.2 `bun test` + typecheck；可选示例 `examples/hooks` 增加 Stop 演示
