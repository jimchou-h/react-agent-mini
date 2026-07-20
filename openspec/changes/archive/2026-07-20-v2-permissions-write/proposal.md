## Why

v1 工具全是只读 + `autoAllow`。要让 Agent「能改代码」必须有 Write；Write 不能静默执行，需要最小权限门槛。本 change 把 Harness **权限柱**从恒 allow 升级为可决策，并交付第一个写工具。

## What Changes

- 引入可注入的 `canUseTool`（替换 `runToolUse` 内写死的 `autoAllowCanUseTool`）
- 只读工具继续 auto-allow；写工具（Write）在 REPL 经 stdin 询问 `y/n`
- 新增 `Write` 工具：写 cwd 内文件（路径校验、大小上限）
- headless / pipe / mock：写工具默认 deny 或需显式 `ALLOW_WRITE=1`（见 design）
- 更新 ToolUseContext、architecture、CONTEXT

## Capabilities

### New Capabilities

- `permission-pipeline`：`canUseTool` 决策（allow / deny），REPL 确认策略
- `write-tool`：`Write` 工具写文件

### Modified Capabilities

- `tool-system`：注册 Write；执行路径走可注入权限回调

## Impact

- **新增**：`src/permissions/` 或 `src/utils/canUseTool.ts`、`src/tools/WriteTool.ts`
- **修改**：`Tool.ts`、`execution.ts`、`ToolUseContext`、`cli`/`repl` 接线
- **风险**：误写文件 → cwd 限制 + 确认 + 体积上限
- **非目标**：Bash、规则引擎、权限记忆「always allow」、Ink 弹窗
- **后续**：MCP 可复用同一 `canUseTool` 钩子
