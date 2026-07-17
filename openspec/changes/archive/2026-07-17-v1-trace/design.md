## Context

v0 实现已完成但调试靠 `console.log` 临时插入。claude-code 有 `debug.ts` / Langfuse；v1 用最小 `trace()` 函数，学习用途为主。

## Goals / Non-Goals

**Goals:**

- `TRACE=1` 时打印固定 stage 名与序列化 detail
- 覆盖：CLI 启动、query turn 开始/结束、callModel 请求摘要、tool_use 执行、tool_result
- 默认关闭，无性能影响

**Non-Goals:**

- JSON 日志、日志级别、文件输出
- Langfuse / OpenTelemetry
- 记录完整 message 正文（仅长度/hash 摘要，避免泄漏）

## Decisions

### 1. API 形状

```ts
export function trace(stage: string, detail?: Record<string, unknown>): void
```

`process.env.TRACE === '1'` 时 `console.error('[trace]', stage, ...)`。

### 2. 埋点位置

| stage | 位置 |
|-------|------|
| `cli.start` | cli.ts |
| `query.turn_start` | query.ts |
| `query.turn_end` | query.ts |
| `api.request` | client.ts（message 数、tool 数） |
| `api.assistant` | stream 结束 |
| `tool.start` / `tool.end` | execution.ts |

### 3. 敏感信息

不打印 API Key、完整文件内容；path 可打印。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| trace 输出与工具状态 stderr 混杂 | 统一 `[trace]` 前缀 |
| 埋点散落 | stage 名集中文档化 |

## Migration Plan

纯增量，无迁移。

## Open Questions

- 无
