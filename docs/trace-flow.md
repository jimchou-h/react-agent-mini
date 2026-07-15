# TRACE 全链路调试

设置 `TRACE=1` 后，Agent 在关键边界向 **stderr** 打印结构化行；默认关闭（零输出）。

实现：`src/utils/trace.ts` → `trace(stage, detail?)`。

## 启用方式

```powershell
$env:TRACE="1"
$env:QUERY_MOCK="1"
npx bun run dev:mock -- "用 Echo 回复 hi"
```

## Stage 列表

| stage | 位置 | detail 示例 |
|-------|------|-------------|
| `cli.start` | `cliHelpers.traceCliStart` / `cli.ts` | `mode=headless\|repl\|pipe` |
| `query.turn_start` | `query.ts` | `turn=1` |
| `api.request` | `client.ts`（真实 callModel） | `messages=N tools=N model=…`（不含 Key） |
| `api.assistant` | `openai/stream.ts` | `kind=text\|tool_use text_len=…` |
| `tool.start` | `execution.ts` | `name=Echo id=…` |
| `tool.end` | `execution.ts` | `name=Echo ok=true\|false` |
| `query.turn_end` | `query.ts` | `reason=completed\|max_turns turn=…` |

> Mock 路径（`QUERY_MOCK=1`）不走真实 `client.ts` / `stream.ts`，因此可能看不到 `api.*`；Echo smoke 仍应出现 cli / query / tool 阶段。

## 示例输出（stderr）

```text
[trace] cli.start mode=headless
[trace] query.turn_start turn=1
[trace] tool.start name=Echo id=toolu_…
[trace] tool.end name=Echo id=toolu_… ok=true
[trace] query.turn_start turn=2
[trace] query.turn_end reason=completed turn=2
```

工具状态行（`[工具] Echo: …`）与 `[trace]` 可并存；用前缀区分。

## 敏感信息

- **不打印** `OPENAI_API_KEY`、完整密钥、完整文件正文
- path、tool 名、计数、长度摘要可打印

## 相关代码

- `src/utils/trace.ts`
- 埋点：`cli.ts` / `cliHelpers.ts`、`query.ts`、`services/api/client.ts`、`services/api/openai/stream.ts`、`services/tools/execution.ts`
