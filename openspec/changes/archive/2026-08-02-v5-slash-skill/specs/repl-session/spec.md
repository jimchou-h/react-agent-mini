## MODIFIED Requirements

### Requirement: Slash 命令

REPL SHALL 识别以 `/` 开头的本地命令，不将其作为模型输入。除内置 `/exit`、`/clear`、`/help`（及后续版本增加的内置如 `/compact`）外，SHALL 支持 MCP prompt slash（形式 `/<server>:<prompt> …`），SHALL 支持已发现 Skill 的 slash（形式 `/<skill-id> [args...]`，`skill-id` 为技能目录名）。解析优先级 SHALL 为：内置 → MCP → Skill → 未知提示。

#### Scenario: /exit 退出

- **WHEN** 用户输入 `/exit` 或 `/quit`
- **THEN** REPL 正常退出，退出码 0

#### Scenario: /clear 清空会话

- **WHEN** 用户输入 `/clear`
- **THEN** `QueryEngine` 消息历史清空，并打印简短确认

#### Scenario: /help 显示帮助

- **WHEN** 用户输入 `/help`
- **THEN** 打印可用 slash 命令列表（含已连接的 MCP prompt 命令，以及已发现 Skill 的 `/<skill-id>` 列表）

#### Scenario: MCP slash 按 @server:uri 挂载后执行 prompt

- **WHEN** 用户输入 `/myserver:greet (MCP) arg1` 或 `/myserver:greet arg1` 且该 MCP prompt 已注册
- **THEN** Host 先 `prompts/get`，再仅挂载结果文本中 `@server:uri` 命中的资源（若有）；无引用则不自动挂载 Resources；再将 prompt 结果注入当前 turn；不将原始 slash 行作为 user 消息

#### Scenario: Skill slash 无参数仅加载

- **WHEN** 用户输入 `/echo-demo` 且已发现技能 `echo-demo`，且无额外参数
- **THEN** 系统将技能正文注入会话（与 Skill 工具注入语义一致），打印已加载确认，不自动调用模型，不将 `/echo-demo` 原文作为 user 消息

#### Scenario: Skill slash 带参数开一轮

- **WHEN** 用户输入 `/skill-creator 帮我写一个 foo skill` 且已发现 `skill-creator`
- **THEN** 系统先注入该技能正文，再以参数文本 `帮我写一个 foo skill` 作为本轮 user 发起 `runTurn`；原始 slash 行不作为 user 消息

#### Scenario: 内置优先于同名 Skill

- **WHEN** 用户输入 `/help` 且存在名为 `help` 的 Skill
- **THEN** 执行内置帮助，不加载该 Skill

#### Scenario: 未知 slash 提示

- **WHEN** 用户输入未知 `/foo` 且非 MCP 命令、亦非已发现 Skill
- **THEN** 打印提示，不送模型
