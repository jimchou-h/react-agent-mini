## Why

v4 已能发现并经 `Skill` 工具按需加载工作流，但用户必须依赖模型自行调用；想立刻跑某个 Skill（如 `skill-creator`）时没有确定性入口。补齐 REPL **slash → Skill**，让 `/<skill-id>` 成为与 `/help`、MCP prompt 并列的本地命令，完成「发现 → 工具调用 → 斜杠直达」闭环。

## What Changes

- REPL 识别已发现技能的 slash：`/<skill-id> [args...]`（`skill-id` = 目录名）
- 命中后：注入该 Skill 正文（与 `Skill` 工具同一注入通道语义），可选把 `args` 作为本轮用户文本开一轮对话；**不**把原始 slash 行当作模型 user
- `/help` 列出可用 Skill slash（与 MCP prompts 分节）
- 解析优先级：内置 slash → MCP `/server:prompt` → Skill → 未知提示
- 附带示例 Skill：`.agents/skills/skill-creator/SKILL.md`（教如何写项目 Skill）
- 文档：README / architecture / skills CONTEXT

**非目标**：

- headless/pipe 解析 `/skill`（仍仅 REPL）
- Skill 市场、用户 home 全局 skills、fork Agent
- 改变 `Skill` 工具契约（slash 是旁路入口，工具仍保留）
- Ink UI、斜杠自动补全 UI

## Capabilities

### New Capabilities

- （无新顶层 capability 名；落在既有 REPL / skill 规格）

### Modified Capabilities

- `repl-session`：增加 Skill slash 解析、注入与 `/help` 列表
- `skill-system`：约定 slash 调用 ID 与工具一致（目录名）；可选 args 语义与注入对齐

## Impact

- **修改**：`entrypoints/repl.ts`（及 slash 解析）、可能抽出 `parseSkillSlash`；`cli` 需把 `skills` 快照传入 REPL；测试与 README
- **新增**：`.agents/skills/skill-creator/SKILL.md`
- **行为**：原先未知的 `/echo-demo` 等将变为可执行 Skill slash（若已发现）
- **关系**：与 `v5-autocompact` 的 `/compact` 并存时，内置命令优先；不阻塞 autocompact 进度
