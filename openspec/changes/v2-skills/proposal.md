## Why

Skills 是 Harness「扩展柱」的入门形态：按需把 `SKILL.md` 注入对话，而不改 `query()` 循环。比 MCP 轻，且建立在 `v2-project-context` 的上下文能力之上，学习路径清晰。

## What Changes

- 扫描 `.agents/skills/*/SKILL.md` 与 `.claude/skills/*/SKILL.md`（cwd 起）
- 解析 frontmatter（至少 `name`）与正文
- 新增 `Skill` 工具：模型传入 skill 名 → 返回技能全文作为 `tool_result`（注入本轮上下文）
- 可选：在 system prompt 中列出可用 skill 名称摘要，便于模型发现
- 注册到 `getTools()`；CLI 状态行支持 Skill

## Capabilities

### New Capabilities

- `skill-system`：技能发现、解析与 `Skill` 工具按需加载

### Modified Capabilities

- `tool-system`：工具注册表包含 Skill

## Impact

- **新增**：`src/skills/`（discover + parse）、`src/tools/SkillTool.ts`
- **依赖**：建议在 `v2-project-context` 之后实现（可发现列表写入 system prompt）
- **非目标**：fork 子 Agent、Skill 内 MCP、用户级全局 skills 目录（可后续加）
- **后续**：MCP 在 design 中标注为 v2.1，不在本 change
