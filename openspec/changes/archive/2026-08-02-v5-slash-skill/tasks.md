## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#80](https://github.com/jimchou-h/react-agent-mini/issues/80) Shared inject + parseSkillSlash | 1.1–1.3 | — |
| [#81](https://github.com/jimchou-h/react-agent-mini/issues/81) REPL wire, /help, cli smoke | 2.1–2.3 | #80 |
| [#82](https://github.com/jimchou-h/react-agent-mini/issues/82) skill-creator + docs | 3.1–3.3 | #81 |

## 1. 共享注入与解析

- [x] 1.1 抽出 Skill 注入正文 helper（与 SkillTool 共用：base dir + 可选 Arguments + body）
- [x] 1.2 实现 `parseSkillSlash(line, skills)`：内置/MCP 之后匹配 `/<id> [args...]`
- [x] 1.3 单测：命中无 args / 有 args / 内置优先 / 未知仍提示

## 2. REPL 接线

- [x] 2.1 `runReplSession` 接收 skills 快照；命中后注入；无 args 仅确认，有 args 则 `runTurn(args)`
- [x] 2.2 `/help` 分节列出 `/<skill-id>`（含 description 摘要可选）
- [x] 2.3 `cli.ts` 把 session skills 传入 REPL；smoke：`/echo-demo` 不 callModel

## 3. 示例与文档

- [x] 3.1 新增 `.agents/skills/skill-creator/SKILL.md`
- [x] 3.2 更新 README / architecture / skills CONTEXT（slash 用法与优先级）
- [x] 3.3 `bun test` + `bun run typecheck` 通过
