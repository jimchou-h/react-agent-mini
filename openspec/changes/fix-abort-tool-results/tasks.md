## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#83](https://github.com/jimchou-h/react-agent-mini/issues/83) synthesize skipped tool_result in runTools | 1.1–1.2 | — |
| [#84](https://github.com/jimchou-h/react-agent-mini/issues/84) query abort keeps pairing | 2.1–2.2 | #83 |

## 1. Orchestration

- [ ] 1.1 `runTools`：aborted 时对剩余 block yield 合成 `is_error` tool_result（常量文案）+ 单测（多工具中途 abort）
- [ ] 1.2 确认合成路径不调用 `call` / hooks（可用 spy 单测）

## 2. Query / 回归

- [ ] 2.1 query abort 场景：同批多 tool_use 拒绝写后，collected 中每个 tool_use 均有 tool_result；`reason: aborted` 仍成立
- [ ] 2.2 `bun test` + `bun run typecheck` 通过
