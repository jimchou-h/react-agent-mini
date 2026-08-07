# UI upstream (Ink / CC shell)

## Source

| Item | Value |
|------|--------|
| Upstream repo | [jimchou-h/claude-code](https://github.com/jimchou-h/claude-code) (claude-code-best lineage) |
| Ink package path upstream | `packages/@ant/ink` → vendored as `packages/@anthropic/ink` (`@anthropic/ink`) |
| Pin (commit) | `d3121f0dfb292b8b9933f89df4106d668ffa8eba` |
| Pin note | `d3121f0d Fix type (#1274)` |

## Layout mapping

| This repo | Claude Code |
|-----------|-------------|
| `packages/@anthropic/ink` | `packages/@ant/ink` |
| `src/ui/**` | `src/**` UI (screens, components, hooks) — relative paths mirror CC under the `src/ui/` prefix |
| `src/ui/components/Markdown.tsx` + `utils/markdownFormat.ts` | CC `components/Markdown.tsx` + `utils/markdown.ts`（当前为 marked+chalk 子集，同步时可整文件替换） |
| `src/host/**` | *(local)* Host Bridge — do not deep-couple UI to `QueryEngine` |

## Upgrade steps (follow when aligning CC)

1. Update the pin commit/tag in this file.
2. Replace `packages/@anthropic/ink` from upstream `packages/@ant/ink`; re-apply entries in `packages/@anthropic/ink/PATCHES.md`.
3. Re-copy selected UI trees into `src/ui/` (prefer whole files over line merges).
4. Fix compile errors via **`src/host/` stubs / Bridge** first; avoid rewriting vendored UI logic.
5. Run `bun test` + `bun run typecheck` + Ink smoke.
6. Note any new local ink diffs in `PATCHES.md`.

## Non-goals for sync

- Do not invent a parallel component tree under different names.
- Do not patch business rules into `@anthropic/ink` internals.
