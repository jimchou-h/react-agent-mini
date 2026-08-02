## ADDED Requirements

### Requirement: Slash 与 Skill 工具共用调用 ID

Skill 的 REPL slash 路径段 SHALL 使用与 `Skill` 工具相同的调用 ID（包含 `SKILL.md` 的目录名）。Slash 注入正文的格式 SHALL 与 `Skill` 工具一致（含 base directory；若有 args 则包含 Arguments 段）。

#### Scenario: slash 与工具同一 ID

- **WHEN** 存在 `.agents/skills/skill-creator/SKILL.md`
- **THEN** 用户可通过 `/skill-creator` 加载，且模型也可通过 `Skill({ "skill": "skill-creator" })` 加载同一技能

#### Scenario: 注入格式含 args

- **WHEN** 用户执行 `/skill-creator make bar`（或模型调用 `Skill` 且 `args` 为 `make bar`）
- **THEN** 注入正文中包含 Arguments 信息与技能 Markdown 正文

### Requirement: 示例 skill-creator

仓库 SHALL 提供 `.agents/skills/skill-creator/SKILL.md`，说明如何在本项目中创建符合约定的 Skill（目录布局、frontmatter、调用 ID=目录名、精简原则）。

#### Scenario: 发现 skill-creator

- **WHEN** 工作区包含示例 `skill-creator`
- **THEN** 技能发现列表含 `skill-creator`，且 `/help` 可列出 `/skill-creator`
