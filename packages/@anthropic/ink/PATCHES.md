# Local patches to vendored `@anthropic/ink`

Upstream: claude-code `packages/@ant/ink` (see `docs/ui-upstream.md`).

| Patch | Reason |
|-------|--------|
| `tsconfig.json` standalone | Upstream extended monorepo `tsconfig.base.json`; replaced with local config for this repo |
| `package.json` deps | Added `semver`, `code-excerpt`, `stack-utils`, `@alcalzone/ansi-tokenize` (provided by CC root, not ink package.json) |
| `theme/ThemeProvider.tsx` | Replaced `bun:bundle` `feature()` with always-false stub (no CC bundler) |
