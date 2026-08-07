# permissions 模块术语表

可注入权限决策。源码：`src/permissions/canUseTool.ts`、`src/Tool.ts`（`CanUseTool` 类型）。

## 核心术语

| 术语 | 说明 |
|------|------|
| **CanUseTool** | `(tool, input, context) => Promise<allow \| deny>` |
| **SessionPermissionRules** | 会话内存 allow 表（工具名 + 可选路径 glob）；不跨进程 |
| **createSessionPermissionRules()** | 创建规则表；`allow` / `matches` / `clear` |
| **createReplCanUseTool(ask, rules?)** | 先匹配规则；否则交互确认；`a`/`always` 写入规则；`n` 时 deny 并 abort |
| **createHeadlessCanUseTool(rules?)** | 非交互；写操作需规则命中或 `ALLOW_WRITE=1` |
| **ALLOW_WRITE** | 环境变量，设为 `1` 时 headless/pipe 允许 Write |
| **abortController** | 每轮 `runTurn` 新建；拒绝写操作时 abort → `Terminal.aborted` |

## 接线

| 入口 | 策略 |
|------|------|
| `cli.ts` headless / pipe | `createHeadlessCanUseTool()` |
| `cli.ts` REPL | `createReplCanUseTool(ask, sessionRules)` |
