# permissions 模块术语表

可注入权限决策。源码：`src/permissions/canUseTool.ts`、`src/Tool.ts`（`CanUseTool` 类型）。

## 核心术语

| 术语 | 说明 |
|------|------|
| **CanUseTool** | `(tool, input, context) => Promise<allow \| deny>` |
| **createReplCanUseTool(ask)** | 交互确认；只读直接 allow；同 path 拒绝后会话内不再追问 |
| **createHeadlessCanUseTool()** | 非交互；写操作需 `ALLOW_WRITE=1` |
| **ALLOW_WRITE** | 环境变量，设为 `1` 时 headless/pipe 允许 Write |

## 接线

| 入口 | 策略 |
|------|------|
| `cli.ts` headless / pipe | `createHeadlessCanUseTool()` |
| `cli.ts` REPL | `createReplCanUseTool(rl.question)` |
