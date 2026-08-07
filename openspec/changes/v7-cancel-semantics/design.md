## Context

v6 `turn-interrupt` 已落地；实测后补了 readline SIGINT 与 idle 双击。本 change 把分散入口收成统一语义文档与代码路径。

## Goals / Non-Goals

**Goals:** 统一 abort 来源映射；三段状态清晰；回归测试。

**Non-Goals:** Escape、rewind 用户输入、后台 agent 取消矩阵。

## Decisions

1. 状态机：`idle` / `running` / `cleanup(after first abort)`。
2. idle：首次无动作；窗口内二次退出。
3. running：首次 abort turn；cleanup 二次 force-exit。
4. 权限 deny / AbortError 与 interrupt 一样结束为 `aborted`（配对规则不变）。

## Risks / Trade-offs

- [行为微调被感知为 breaking] → 文档与 changelog 写清

## Open Questions

无。
