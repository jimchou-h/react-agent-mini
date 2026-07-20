# skill-system Specification

## Purpose

工作区 Skill 发现、解析与按需加载：扫描 `SKILL.md`、在 system prompt 中提供可用技能摘要，并通过只读 `Skill` 工具返回正文。

## Requirements

### Requirement: 技能发现

系统 SHALL 扫描工作区下 `.agents/skills/*/SKILL.md` 与 `.claude/skills/*/SKILL.md`，解析为可调用技能列表。

#### Scenario: 发现本地 skill

- **WHEN** 存在 `.agents/skills/foo/SKILL.md` 且 frontmatter 含 `name: foo`
- **THEN** 技能列表包含名为 `foo` 的条目

#### Scenario: 无 skills 目录

- **WHEN** 两个扫描根目录均不存在
- **THEN** 技能列表为空，系统仍可正常启动

### Requirement: Skill 工具

系统 SHALL 提供 `Skill` 工具，接受技能名称参数，返回该技能的 Markdown 正文。

#### Scenario: 加载已知技能

- **WHEN** 模型调用 `Skill` 且 `skill` 为已发现名称
- **THEN** `tool_result` 包含对应 `SKILL.md` 正文（非错误）

#### Scenario: 未知技能

- **WHEN** 模型调用 `Skill` 且名称未注册
- **THEN** `tool_result` 标记为错误，说明技能不存在

### Requirement: 可用技能提示

系统 SHALL 在 system prompt（或等价通道）中提供可用技能名称摘要，便于模型决定何时调用 `Skill`。

#### Scenario: 列表出现在 system 中

- **WHEN** 至少发现一个 skill 且已启用 project system prompt
- **THEN** system 内容包含该技能名称（及可选简短描述）
