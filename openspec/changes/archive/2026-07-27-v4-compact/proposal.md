## Why

> **归档说明**：本 change 已由 `v4-claude-align`（PR #66）吸收实现；保留归档供 blog 叙事与历史追溯。

v3 compact 每轮按固定阈值裁剪，历史明明装得下也会被「扔」。长会话需要更聪明的 Context Budget：接近上限才动，且优先清掉可再生的旧 `tool_result`，而不是整段丢掉对话骨架。这正好接续 compact blog，写成「从扔掉到清可再生载荷」。

## What Changes

- **阈值触发**：用字符近似估算出站规模；仅当超过配置阈值（相对上下文预算或绝对字符上限）才执行加重裁剪
- **microcompact**：对较早轮次的大块 `tool_result` 替换为短占位（提示可重新 Read/Bash），保留 user/assistant 文本与 tool_use 配对
- 保留 v3 的硬截断与 `maxMessages` 保尾作为兜底；`COMPACT=0` 仍关闭全部
- TRACE：区分 `compact.run` / `compact.micro`（或统一字段标明策略）
- 文档与 blog 角度材料

## Capabilities

### New Capabilities

- （无新顶层 capability 名；扩展既有 context-compact）

### Modified Capabilities

- `context-compact`：增加阈值触发与 microcompact 策略
- `react-loop`：若 query 接线需感知「何时跳过轻量路径」则补充场景（可选，多数逻辑可留在 compactMessages）

## Impact

- **修改**：`src/services/compact/`、相关测试、README / architecture / CONTEXT
- **非目标**：LLM autocompact（摘要）— 留给 v5 / 独立深度篇；写回 Engine.messages 仍可选后续
- **Blog**：续篇结构；对比 v3「丢」vs v4「清」

## Blog 角度

| 要素 | 内容 |
|------|------|
| 钩子 | 「上下文不是垃圾桶：不该每轮都扔」 |
| 隐喻 | 书柜满了先收可再借的书（tool_result），日记本（对话）先留着 |
| 演示 | 造超长 tool_result 历史；TRACE 看出站前后；再 Read 同一文件证明可再生 |
| 刻意不做 | 本文不讲 LLM 摘要；那是下一篇实验 |
