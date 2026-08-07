# repl-session Specification

## Purpose

交互 REPL 会话：readline 多轮对话、slash 本地命令与共用流式输出约定。
## Requirements
### Requirement: 交互 REPL 循环

系统 SHALL 在无 CLI 问题参数时启动 readline REPL，显示提示符并循环读取用户输入。

#### Scenario: 无参数启动 REPL

- **WHEN** 用户执行 `bun run dev`（或 `dev:mock`）且未传问题文本、未使用 `-p`
- **THEN** 进入 REPL，显示 `> ` 提示符并等待输入

#### Scenario: 连续多轮对话

- **WHEN** 用户在 REPL 中连续输入两条不同问题
- **THEN** 每轮均调用 Agent 并输出回复，且第二轮可访问第一轮对话历史

#### Scenario: 空行跳过

- **WHEN** 用户只按回车提交空行
- **THEN** 不发起 query，继续显示提示符

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

### Requirement: /compact 手动摘要

REPL SHALL 支持 `/compact`：对当前会话执行与 autocompact 相同的 LLM 摘要压缩并写回 `QueryEngine` 消息历史。短会话亦可强制执行。成功时 SHALL 打印确认（宜含压缩前后上下文占用 %）；失败时 SHALL 打印可读错误且不改写会话。

#### Scenario: 手动压缩成功

- **WHEN** 用户输入 `/compact` 且侧路摘要成功
- **THEN** 会话历史被摘要 + 尾部替换（含 compact boundary），REPL 打印确认，不发起普通 user turn

#### Scenario: 手动压缩失败

- **WHEN** 用户输入 `/compact` 且摘要失败
- **THEN** 会话不变，REPL 打印错误，不送模型作为普通消息

### Requirement: 轮次后展示上下文占用

REPL 在每轮正常结束后 SHALL 展示当前上下文占用百分比（估算或基于 usage），与 `context-compact` 中占用要求一致。

#### Scenario: 普通轮次后可见 ctx %

- **WHEN** 用户完成一轮非 slash 对话
- **THEN** 输出中可见上下文占用百分比提示

### Requirement: 普通消息中的 @server:uri

REPL 对**非 slash** 的用户输入 SHALL 解析文本中的 `@server:uri`；命中时 SHALL 将对应 Resource 以 meta 消息注入当前 turn（排在用户原文之前），用户原文仍作为本轮 user 消息发送（对齐 claude-code 普通输入附件解析）。无引用时 SHALL NOT 自动挂载 Resources。

#### Scenario: 普通消息含 @server:uri

- **WHEN** 用户输入 `请根据 @tour:docs://handbook 安排行程`（非 `/` 开头）且 `tour` 已连接、该 uri 可读
- **THEN** Host 先注入该 Resource meta 消息，再发送用户原文；REPL 可提示已挂载数量

#### Scenario: 普通消息无 @server:uri

- **WHEN** 用户输入不含 `@server:uri` 的普通文本
- **THEN** 行为与既有一致：直接 `runTurn` 用户原文，不自动挂载 Resources

### Requirement: REPL 流式输出

REPL SHALL 与 headless 模式使用相同的流式输出约定（text → stdout，工具状态 → stderr）。

#### Scenario: 工具状态在 REPL 中可见

- **WHEN** REPL 会话中 Agent 调用 Read 工具
- **THEN** stderr 打印 `[工具] Read: path` 格式状态行

### Requirement: REPL 支持 /init

`parseSlashCommand`（或等价）SHALL 识别 `/init`；`runReplSession` SHALL 按 slash-init 能力执行注入与查询。

#### Scenario: 解析 /init

- **WHEN** 输入行为 `/init` 或 `/init` 加参数
- **THEN** 解析为 init 命令而非未知 slash

### Requirement: 上下文状态可查询

REPL SHALL 提供查看当前上下文占用的途径（现有 ctx 行、`/status` 或等价）。

#### Scenario: 用户可看到占用

- **WHEN** 完成一轮对话或查询状态
- **THEN** 用户能获知当前 context 占用估计

