## Why

Claude Code 有规则化权限与 always-allow；mini 目前 REPL 每次写操作都 `y/N`，长会话打断频繁。在现有 `canUseTool` 上做精简规则层，对齐 CC「可记住允许」的方向，但不做 Ink 弹窗。

## What Changes

- 支持本轮/会话级「记住允许」某工具或路径模式
- REPL 确认流程读取规则后再问；命中 allow 则跳过确认
- headless 仍默认 deny 写工具（可用 env/规则放行）
- 文档说明规则作用域与安全边界

## Capabilities

### New Capabilities

- `permission-rules`: 精简 allow 规则与会话记忆

### Modified Capabilities

- `permission-pipeline`: REPL/headless 与规则层交互
- `cli-entrypoint` / `repl-session`: 确认 UX 变化（若有）

## Impact

- `permissions/canUseTool.ts` 及规则存储（内存优先）
- 无 Ink；无企业策略引擎
