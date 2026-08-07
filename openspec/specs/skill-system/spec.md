# skill-system Specification

## Purpose

工作区 Skill 发现、解析与按需加载：扫描 `SKILL.md`、在 system prompt 中提供可用技能摘要，并通过只读 `Skill` 工具注入正文。
## Requirements
### Requirement: 技能发现

系统 SHALL 扫描工作区下 `.agents/skills/*/SKILL.md` 与 `.claude/skills/*/SKILL.md`，解析为可调用技能列表。技能的**调用 ID** SHALL 为包含 `SKILL.md` 的目录名；frontmatter 中的 `name` 仅作展示名（displayName），不作为 `Skill` 工具入参。

#### Scenario: 发现本地 skill

- **WHEN** 存在 `.agents/skills/foo/SKILL.md` 且 frontmatter 含 `name: display-foo`
- **THEN** 技能列表包含调用 ID `foo`；system 摘要可展示 `display-foo`

#### Scenario: 无 skills 目录

- **WHEN** 两个扫描根目录均不存在
- **THEN** 技能列表为空，系统仍可正常启动

### Requirement: Skill 工具

系统 SHALL 提供 `Skill` 工具，接受技能名称（目录名）与可选 `args`，加载技能正文。技能正文 SHALL 通过会话消息注入通道提供给模型；`tool_result` SHALL 为短确认文案（非全文正文）。

#### Scenario: 加载已知技能

- **WHEN** 模型调用 `Skill` 且 `skill` 为已发现目录名
- **THEN** 技能正文进入注入通道，且 `tool_result` 为短确认文案（非错误）

#### Scenario: 未知技能

- **WHEN** 模型调用 `Skill` 且名称未注册
- **THEN** `tool_result` 标记为错误，说明技能不存在

### Requirement: 可用技能提示

系统 SHALL 在 system prompt（或等价通道）中提供可用技能名称摘要，便于模型决定何时调用 `Skill`。

#### Scenario: 列表出现在 system 中

- **WHEN** 至少发现一个 skill 且已启用 project system prompt
- **THEN** system 内容包含该技能的调用 ID（及可选 displayName / 描述）

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

### Requirement: Skill 注入消息在 tool_result 之后

当 `Skill` 工具成功加载技能时，系统 SHALL 先将对应 `tool_use` 的 `tool_result`（短确认文案）追加到会话，再追加技能正文注入消息。系统 SHALL NOT 在含该 `tool_use` 的 assistant 消息与其配对 `tool_result` 之间插入纯文本 user 消息。

#### Scenario: 成功加载后历史顺序

- **WHEN** 模型调用 `Skill` 且技能存在
- **THEN** 会话中该 `tool_use` 之后的下一条相关消息含配对 `tool_result`，技能正文注入消息出现在该 `tool_result` 之后

#### Scenario: 未知技能不注入正文

- **WHEN** 模型调用 `Skill` 且技能不存在
- **THEN** 仅有错误 `tool_result`，不追加技能正文注入消息

