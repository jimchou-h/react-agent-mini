## Context

v0 `cli.ts` 构造单条 `user` 消息、调用 `query()` 一次后退出。claude-code 用 `QueryEngine` + `REPL.tsx` 管理多轮用户输入与会话状态。v1 用 **Node readline**（Bun 兼容）实现轻量 REPL，不上 Ink。

## Goals / Non-Goals

**Goals:**

- 无参数 `bun run dev` 进入交互 REPL，连续多轮对话且上下文不丢
- `QueryEngine` 对齐 claude-code 职责子集：messages 累积、单 turn query
- slash 命令：`/exit`、`/clear`、`/help`
- headless / pipe 模式与 v0 完全兼容

**Non-Goals:**

- Ink UI、权限弹窗、会话持久化到磁盘
- slash 命令扩展（`/model` 等）留后续
- QueryEngine 的 compact、file history、attribution

## Decisions

### 1. readline 而非 Ink

**选择**：`node:readline/promises` 或 `createInterface` 循环读行。

**理由**：零 UI 依赖、跨平台、学习焦点在 L1→L2 边界；未来可换 Ink 而不改 QueryEngine。

### 2. QueryEngine API

**选择**：

```ts
class QueryEngine {
  constructor(params: { tools, toolUseContext, deps? })
  get messages(): Message[]
  async *runTurn(userText: string): AsyncGenerator<QueryYield, Terminal>
  clear(): void
}
```

`runTurn` 内部：`messages.push(user)` → `query({ messages, ... })` → 将 query 产出的新消息合并回 `messages`。

**理由**：REPL 与测试共用；headless 可不引入 QueryEngine（或可选引入）。

### 3. CLI 路由

**选择**：

| 启动方式 | 行为 |
|----------|------|
| `dev` 无参数 | REPL |
| `dev -- "问题"` | headless（v0） |
| `dev -p` | pipe（v0） |
| `dev --mock` 无参数 | mock REPL |

**理由**：符合「像 claude-code 一样启动就等输入」；显式传参仍走 headless。

### 4. 输出复用

**选择**：从 `cli.ts` 抽出 `consumeQueryStream(generator)`，REPL 每轮调用。

**理由**：避免 REPL/headless 双份流式打印逻辑。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Windows readline 体验差 | 文档注明；PowerShell 下测试 |
| messages 无限增长 | v1 不 compact；`/clear` 重置；长对话留 v2 |
| mock 模式 REPL 无真实多轮智能 | 验收用真实 API 或扩展 mock |

## Migration Plan

无破坏性变更。headless 用法不变。README 补充 REPL 启动说明。

## Open Questions

- （已关闭）REPL 提示符 → `> `
- 是否在 package.json 加 `dev:repl` 别名 → 可选，默认无参数即可
