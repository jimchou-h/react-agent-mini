# mcp-prompts Specification

## Purpose

MCP Prompts Host 能力：list/get 提示模板，经 REPL slash 注入当前 turn（对齐 claude-code，不经 SkillTool）。

## Requirements

### Requirement: MCP Prompts 列表与获取

系统 SHALL 能对声明 `prompts` 能力的 MCP server 执行 `prompts/list` 与 `prompts/get`。list 失败或无能力时 SHALL fail-soft 返回空列表。

#### Scenario: Host 侧列出 prompts

- **WHEN** server 声明 `prompts` 且 Host 调用内部 list API
- **THEN** 返回 prompt 名称与描述（若有）

#### Scenario: Host 侧获取 prompt

- **WHEN** Host 对合法 prompt 名调用 `prompts/get`，并提供与 `prompt.arguments` 对齐的参数
- **THEN** 返回 prompt 消息列表（text / 等价 content blocks）

#### Scenario: server 无 prompts

- **WHEN** server 未声明 `prompts`
- **THEN** list 返回 `[]`，且不影响该 server 的 tools 调用

### Requirement: MCP Prompt 命名约定

系统 SHALL 将 MCP prompt 映射为 REPL slash 命令，命名对齐 claude-code：

- 内部标识：`mcp__<normalizedServer>__<prompt.name>`
- 用户输入面：`/<server>:<prompt.name> (MCP) [args...]`，亦 SHALL 接受省略 `(MCP)` 的 `/<server>:<prompt.name> [args...]`（命令已注册时）

#### Scenario: slash 帮助可见

- **WHEN** REPL 用户输入 `/help` 且存在 MCP prompts
- **THEN** 帮助输出包含 MCP slash 命令（含 `(MCP)` 标记与 server:prompt 形式）

#### Scenario: 省略 (MCP) 亦可命中

- **WHEN** 用户输入 `/demo:greet world` 且该 MCP prompt 已注册
- **THEN** 与带 `(MCP)` 写法等价，执行同一 prompt

### Requirement: MCP Prompt 经 slash 注入

系统 SHALL 通过 REPL slash 执行 MCP prompt。执行时 SHALL 先将该 prompt 所属 server 的 Resources（若有）读取并作为 **meta 消息**挂入当前 turn，再将 `prompts/get` 结果注入；SHALL NOT 将 MCP prompt 暴露为 Skill 工具或自动追加到持久 `systemPrompt`。

#### Scenario: 执行 MCP slash

- **WHEN** REPL 用户输入 `/demo:greet (MCP) world` 且 `demo` server 暴露 `greet` prompt
- **THEN** Host 调用 `prompts/get`（`world` 映射到声明的参数），并将结果注入当前 turn

#### Scenario: slash 前挂载同 server Resources

- **WHEN** 执行 MCP slash 且该 server 声明 `resources` 并暴露可读资源
- **THEN** 资源正文以 meta 消息先于 prompt 注入当前 turn；REPL 可提示已挂载数量

#### Scenario: slash 不作为普通 user 输入

- **WHEN** 用户输入合法 MCP slash
- **THEN** 该输入不原样作为模型 user 文本；仅注入资源（若有）与 get 得到的 prompt 内容

#### Scenario: 获取失败

- **WHEN** `prompts/get` 失败
- **THEN** REPL 打印可读错误，不发起 query 或 abort 当前 turn

#### Scenario: headless 不预装 MCP slash

- **WHEN** 非 REPL 模式（headless/pipe）
- **THEN** 不自动执行 MCP slash；文档说明 prompts 为 REPL 能力

### Requirement: Prompt 不经 SkillTool

系统 SHALL NOT 将普通 MCP prompts 合并进 `Skill` 工具可选列表。

#### Scenario: Skill 工具不含 MCP prompt

- **WHEN** 模型查看可用 Skill 或调用 Skill
- **THEN** 列表中不出现 MCP prompt 名称
