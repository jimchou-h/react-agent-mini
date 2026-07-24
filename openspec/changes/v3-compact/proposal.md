## Why

REPL 长会话下 `messages[]` 无限增长，会撞模型上下文或拖慢/变贵。v3 补上 Harness **Context Budget** 柱：在调模型前对历史做确定性裁剪（不做 LLM autocompact），让长对话可续跑。

## What Changes

- 新增 `compactMessages(messages, options)`：保留最近 N 轮 user turn，截断或替换更早的大块 `tool_result`
- 在 `query()` 每轮 `callModel` 前可选执行 compact（或由 QueryEngine 在 `runTurn` 前执行）
- 配置：`maxMessages` / `maxToolResultChars`（环境变量或常量默认值）
- TRACE 埋点：`compact.run`（前后消息数）
- 文档说明策略与限制

## Capabilities

### New Capabilities

- `context-compact`：对话历史裁剪策略与接线

### Modified Capabilities

- `react-loop`：`query` / `QueryParams` 支持 compact 选项
- `query-engine`：会话层可触发或感知 compact（若实现落在 Engine）

## Impact

- **新增**：`src/services/compact/` 或 `src/utils/compact.ts`
- **修改**：`query.ts` 和/或 `QueryEngine.ts`
- **非目标**：LLM 摘要压缩、microcompact 精细策略、token 精确计数（可用字符近似）
