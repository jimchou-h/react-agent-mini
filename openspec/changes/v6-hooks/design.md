## Context

工具执行在 `canUseTool` → `Tool.call` 之间缺少用户扩展点。CC 的 `utils/hooks.ts` 支持多事件；mini 只做 Pre/PostToolUse（+ 可选 Stop）。

## Goals / Non-Goals

**Goals:** 可配置 hooks；工具前后执行；安全默认；可测 seam。

**Non-Goals:** Compact hooks、SessionStart 全家桶、Agent hooks、完整 CC settings 兼容。

## Decisions

### 1. 配置形态

优先读取工作区 JSON（候选：`.claude/settings.json` 的 `hooks` 键，或 `.agents/hooks.json`）。只支持 command 型 hook 的最小字段：`matcher`（工具名 glob/精确）+ `command`。

### 2. 执行时机

```
validateInput → canUseTool → PreToolUse → Tool.call → PostToolUse
```

PreToolUse 可返回 deny（跳过 call）；PostToolUse 默认只观测。

### 3. Stop（可选同一 change 后半）

模型将 end_turn 时跑 Stop hooks；若要求继续则注入合成 user 消息再进一轮。可标为 tasks 后半可选。

### 4. 安全

- `HOOKS=0` 或未配置 → 跳过
- 交互模式下仅加载 cwd 信任路径内配置；命令经 shell 时必须文档警示
- hook 超时与非零退出：默认 fail-soft（允许工具继续），Pre 可配置为 deny-on-failure

### 5. 落位

`services/hooks/*`；工具执行路径调用；单测注入 fake runner。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| RCE | 默认关 / 信任边界 / 文档 |
| 延迟 | 超时；并行 Post 可后续 |

## Open Questions

- settings 文件最终选 `.claude/settings.json` 子集还是独立 `.agents/hooks.json`：实现前按「先独立文件、文档说明可对齐 CC 键名」执行
