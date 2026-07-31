## Why

工具执行与权限已有，但缺少用户可配置的生命周期扩展点。claude-code 用 settings hooks（Pre/PostToolUse、Stop 等）做审计、拦截与编排；mini 要对齐 harness 可扩展性，需先落最小 hooks 面，而不是等 memory / 子代理。

## What Changes

- **Hook 运行时**：从项目配置（如 `.claude/settings.json` / `.agents/hooks.json` 精简子集）加载 hooks
- **最小事件集**：`PreToolUse`、`PostToolUse`（配置：`.agents/hooks.json`）
- **接线**：在 `canUseTool` 通过之后、`Tool.call` 前后执行；失败 fail-soft（可配置 deny）
- **安全**：未信任 / 显式关闭时跳过所有 hooks（对齐 CC「防 RCE」方向的精简版）
- TRACE 可观测 hook 执行摘要（`hooks.pre` / `hooks.post`）

**非目标**：

- **Stop hook**（本 change **推迟**，不做；后续单独 change）
- Agent hooks、SessionStart 全家桶、UI React hooks
- PreCompact/PostCompact（可后续挂 compact）
- memory、子代理、完整 settings schema 兼容层

## Capabilities

### New Capabilities

- `hooks`: 用户可配置的 lifecycle hooks 加载、匹配与执行

### Modified Capabilities

- `tool-system` 或执行路径：tool 前后调用 hooks
- `permission-pipeline`：PreToolUse 可与权限决策协同（deny / 附加 message）
- `repl-session`：文档与可观测（可选）

## Impact

- **新增**：`services/hooks/*` 或 `utils/hooks` 精简模块
- **修改**：工具执行流水线（`runTools` / toolExecution 等价物）、配置加载
- **安全**：默认关闭或仅信任 cwd 配置；命令型 hook 需明确警告
