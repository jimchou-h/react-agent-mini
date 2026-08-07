## Why

v6 已接通 Ctrl+C / abort 级联，但「结束当前 turn」入口仍分散（interrupt、权限 deny、AbortError、收尾强退）。对齐 Claude Code 的 cancel 语义，收成统一状态机，避免再次出现 idle/收尾发黏。

## What Changes

- 统一终端 reason / 会话可继续规则：interrupt、deny、流中 AbortError
- 明确状态：`running` → 首次 abort；`cleanup` → 二次强退；`idle` → 首次无动作、窗口内二次退出
- 文档与单测覆盖三条路径；必要时抽出共享 helper
- 不引入 Escape 全键盘或消息 rewind UI

## Capabilities

### New Capabilities

（无；收口既有行为）

### Modified Capabilities

- `turn-interrupt`: 固化 running/cleanup/idle 三段语义与二次强退
- `react-loop`: 明确各 abort 来源均映射为可预期 `aborted` / 配对规则

## Impact

- 主要改 `turnInterrupt`、`QueryEngine`、`query`、REPL 文档
- 行为微调，尽量无 BREAKING；文档更新为主
