# permissions 模块术语表

可注入权限决策。源码：`src/permissions/canUseTool.ts`、`src/Tool.ts`（`CanUseTool` 类型）。

## 核心术语

| 术语 | 说明 |
|------|------|
| **CanUseTool** | `(tool, input, context) => Promise<allow \| deny>` |
| **createReplCanUseTool(ask)** | 交互确认；用户 `n` 时 deny 并 abort 本轮 |
| **createHeadlessCanUseTool()** | 非交互；写操作需 `ALLOW_WRITE=1` |
| **ALLOW_WRITE** | 环境变量，设为 `1` 时 headless/pipe 允许 Write |
| **abortController** | 每轮 `runTurn` 新建；拒绝写操作时 abort → `Terminal.aborted` |

## 接线

| 入口 | 策略 |
|------|------|
| `cli.ts` headless / pipe | `createHeadlessCanUseTool()` |
| `cli.ts` REPL | `createReplCanUseTool(rl.question)` |
