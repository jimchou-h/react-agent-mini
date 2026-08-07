## Why

compact/autocompact 已能工作，但对用户仍偏「黑盒保护」。对齐 Claude Code 让上下文管理更可预期：何时压、压了什么、之后能否继续。

## What Changes

- 压缩前后更清晰的用户可见反馈（REPL 打印 / TRACE）
- 保留策略与摘要可读性微调
- `/status` 或等价展示 context 占用（若落入本 change）
- 文档说明触发条件与关闭开关

## Capabilities

### New Capabilities

（无；体验增量）

### Modified Capabilities

- `context-compact`: 可观测性与用户反馈要求
- `repl-session`: compact 结果展示（若改）

## Impact

- `services/compact/*`、REPL `/compact` 输出
- 不重做完整 CC compact 策略树
