## 1. 发现与解析

- [x] 1.1 实现 `src/skills/discover.ts`：扫描两路径、解析 frontmatter + body
- [x] 1.2 单元测试：发现、缺 name 回退目录名、空目录、大小截断

## 2. Skill 工具

- [x] 2.1 实现 `src/tools/SkillTool.ts`
- [x] 2.2 注册到 `getTools()`；`cliHelpers` 状态行
- [x] 2.3 单元测试：成功加载 / 未知名

## 3. 与 system prompt 集成

- [x] 3.1 将可用 skills 摘要追加到 `loadProjectContext` 结果或独立 `buildSystemPrompt()`
- [x] 3.2 CLI / QueryEngine 使用合并后的 system prompt

## 4. 文档与验收

- [ ] 4.1 示例 skill（如 `.agents/skills/echo-demo/SKILL.md`）+ README / architecture
- [ ] 4.2 `bun run typecheck` 与 `bun test` 通过
- [ ] 4.3 Smoke：模型或 mock 调用 Skill 后能引用技能内容

## 依赖

- [x] 4.4 确认 `v2-project-context` 已合入（或本 change 内自带最小 systemPrompt 拼装）
