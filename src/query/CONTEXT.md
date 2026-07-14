# query 模块术语表

ReAct 主循环与 `query()` 公共 API。源码入口：`src/query.ts`、`src/query/deps.ts`、`src/query/types.ts`。

## 核心概念

| 术语 | 英文 | 说明 |
|------|------|------|
| **query** | `query()` | 异步生成器主入口；一次用户请求对应一次调用 |
| **queryLoop** | `queryLoop()` | 内部 `while(true)` 循环体，不对外导出 |
| **ReAct 轮次** | turn | 一次 `callModel` +（可选）`runTools`；`turnCount` 从 1 递增 |
| **needsFollowUp** | needs follow-up | 本轮 assistant 含 `tool_use` 则为 true，触发工具执行与下一轮 |
| **Terminal** | terminal reason | 生成器 `return` 值：`completed` 或 `max_turns` |
| **maxTurns** | max turns | 工具轮次上限，默认 20，防止无限循环 |

## 类型

| 术语 | 类型 | 说明 |
|------|------|------|
| **QueryParams** | 入参 | `messages`、`tools`、`toolUseContext`、可选 `maxTurns` / `deps` |
| **QueryState** | 内部状态 | `messages` + `turnCount`，每轮整体替换 |
| **QueryDeps** | 依赖注入 | `{ callModel, uuid }`；测试注入 fake，生产用 `productionDeps()` |
| **CallModel** | 函数签名 | 流式 yield `text_delta` 或 `AssistantMessage` |
| **CallModelParams** | Provider 入参 | 当前 `messages` + `tools` schema |
| **QueryYield** | yield 类型 | `StreamEvent` \| `UserMessage` \| `AssistantMessage` |

## 依赖注入

| 术语 | 说明 |
|------|------|
| **productionDeps** | 默认依赖：`QUERY_MOCK=1` → mock；否则真实 `callModel` |
| **deps 覆盖** | `query({ ..., deps })` 用于单元测试，避免 `mock.module` 全局污染 |


## L1 会话层

| 术语 | 英文 | 说明 |
|------|------|------|
| **QueryEngine** | QueryEngine | 跨多轮用户输入累积 messages；runTurn / clear |
| **runTurn** | runTurn | 追加 user → query() → 合并 yield 的消息 |

## 与 claude-code 对齐点

- `async function* query()` 签名与 yield 语义
- `needsFollowUp` 不依赖 `stop_reason`
- `appendTurnMessages` 追加 assistant + tool_results
- v0 未实现：compact、权限 UI、流式工具执行、hooks

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/query.ts` | `query()`、`queryLoop()` |
| `src/query/deps.ts` | `QueryDeps`、`productionDeps()` |
| `src/query/types.ts` | `QueryParams`、`Terminal`、`CallModel` |
| `src/QueryEngine.ts` | L1 QueryEngine 会话封装 |
