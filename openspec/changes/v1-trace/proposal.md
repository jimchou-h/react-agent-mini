## Why

学习 Harness 时需要看清数据在 L1→L2→L3→L4 的流转；v0 仅有 stderr 工具状态，缺少结构化全链路日志。`TRACE=1` 可在不改业务逻辑的前提下打印关键边界事件，对齐此前 `trace-flow.md` 学习笔记。

## What Changes

- 新增 `src/utils/trace.ts`：`trace(stage, detail)`，仅 `TRACE=1` 时输出
- 在 cli、query、callModel、adapter、stream、runToolUse 埋点
- 输出格式：`[trace] stage key=value ...` 到 stderr
- 文档：`docs/learning/trace-flow.md`（或更新既有笔记）与 architecture 交叉引用

## Capabilities

### New Capabilities

- `trace-debug`：环境变量 `TRACE=1` 启用的结构化调试日志

### Modified Capabilities

（无 — 不改变对外行为，仅增加可观测性）

## Impact

- **新增**：`src/utils/trace.ts`
- **修改**：`cli.ts`、`query.ts`、`client.ts`、`adapter.ts`、`stream.ts`、`execution.ts`（各 1～3 处埋点）
- **不影响**：默认 `TRACE` 未设置时零开销、零输出
