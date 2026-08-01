---
name: skill-creator
description: Guide for creating project Skills (directory layout, frontmatter, slash ID)
---

# Skill creator

Help the user add a new project Skill under `.agents/skills/` (or `.claude/skills/`).

## Layout

```text
.agents/skills/<skill-id>/SKILL.md
```

- **`<skill-id>`** = directory name = call ID for `Skill({ "skill": "<skill-id>" })` and REPL `/<skill-id>`
- File name must be exactly `SKILL.md`

## Frontmatter

```yaml
---
name: optional-display-name
description: One-line summary for system catalog and /help
---
```

If `name` is omitted, the directory name is used as the display fallback. The **call ID is always the directory name**, not the frontmatter `name`.

## Body

- Write concrete steps the model should follow
- Keep it short; bodies over 32KB are truncated
- Prefer actionable checklists over long essays

## How users invoke

| Path | Example |
|------|---------|
| REPL slash (no args) | `/skill-creator` → loads into session, no model call |
| REPL slash (with args) | `/skill-creator 写一个 foo skill` → inject + one turn |
| Tool | `Skill({ "skill": "skill-creator", "args": "..." })` |

Slash priority: built-in (`/help`, `/clear`, …) → MCP `/server:prompt` → Skill → unknown.

## Checklist when creating

1. Pick a stable `<skill-id>` (avoid `help` / `clear` / `exit` / `compact`)
2. Write frontmatter `description`
3. Write body steps
4. Restart REPL (skills scanned once at startup) and try `/<skill-id>`
