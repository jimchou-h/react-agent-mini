# react-agent-mini

## Agent skills

### Issue tracker

Issues live as GitHub issues in this repo (`jimchou-h/react-agent-mini`). See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles; label strings match role names exactly. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout — `CONTEXT-MAP.md` at the repo root points to per-context `CONTEXT.md` files. See `docs/agents/domain.md`.

### Architecture alignment

Future development in this repo should follow `docs/architecture-alignment.md` and `.cursor/rules/align-claude-code.mdc`:

- Align with `claude-code` on concepts, boundaries, **prompts, and protocols** — **read CC source first, copy by default**; only omit what Non-Goals explicitly cut (no Ink, etc.).
- Keep mini-repo pragmatism on **repo size / platform**, not by inventing rewritten semantics or homemade guide prompts.
- Avoid premature over-splitting of directories/files.
