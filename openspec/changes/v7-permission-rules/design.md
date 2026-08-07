## Context

现有 `createReplCanUseTool` / headless deny。对齐 CC always-allow 的最小可用子集。

## Goals / Non-Goals

**Goals:** 会话内存规则；命中则跳过确认；可清除。

**Non-Goals:** 持久化跨进程策略文件（可后续）、Ink UI、企业托管策略。

## Decisions

1. 规则存 `QueryEngine` 或 session 级结构（随进程）。
2. 粒度：工具名，可选路径 glob（写工具）。
3. REPL 确认文案可提示「本轮始终允许」。
4. headless：规则或 `ALLOW_WRITE` 仍是放行通道。

## Risks / Trade-offs

- [误永久放行] → 默认仅会话级；文档强调

## Open Questions

是否需要 `/permissions` slash：实现时可选，非阻塞。
