## MODIFIED Requirements

### Requirement: Slash 命令

REPL SHALL 识别以 `/` 开头的本地命令，不将其作为模型输入。除内置 `/exit`、`/clear`、`/help` 外，SHALL 支持 MCP prompt slash 命令（形式 `/<server>:<prompt> (MCP) [args...]`，或省略 `(MCP)` 的 `/<server>:<prompt> [args...]`）。

#### Scenario: /exit 退出

- **WHEN** 用户输入 `/exit` 或 `/quit`
- **THEN** REPL 正常退出，退出码 0

#### Scenario: /clear 清空会话

- **WHEN** 用户输入 `/clear`
- **THEN** `QueryEngine` 消息历史清空，并打印简短确认

#### Scenario: /help 显示帮助

- **WHEN** 用户输入 `/help`
- **THEN** 打印可用 slash 命令列表（含已连接的 MCP prompt 命令）

#### Scenario: MCP slash 按 @server:uri 挂载后执行 prompt

- **WHEN** 用户输入 `/myserver:greet (MCP) arg1` 或 `/myserver:greet arg1` 且该 MCP prompt 已注册
- **THEN** Host 先 `prompts/get`，再仅挂载结果文本中 `@server:uri` 命中的资源（若有）；无引用则不自动挂载 Resources；再将 prompt 结果注入当前 turn；不将原始 slash 行作为 user 消息

#### Scenario: 未知 slash 提示

- **WHEN** 用户输入未知 `/foo` 且非 MCP 命令
- **THEN** 打印提示，不送模型

## ADDED Requirements

### Requirement: 普通消息中的 @server:uri

REPL 对**非 slash** 的用户输入 SHALL 解析文本中的 `@server:uri`；命中时 SHALL 将对应 Resource 以 meta 消息注入当前 turn（排在用户原文之前），用户原文仍作为本轮 user 消息发送（对齐 claude-code 普通输入附件解析）。无引用时 SHALL NOT 自动挂载 Resources。

#### Scenario: 普通消息含 @server:uri

- **WHEN** 用户输入 `请根据 @tour:docs://handbook 安排行程`（非 `/` 开头）且 `tour` 已连接、该 uri 可读
- **THEN** Host 先注入该 Resource meta 消息，再发送用户原文；REPL 可提示已挂载数量

#### Scenario: 普通消息无 @server:uri

- **WHEN** 用户输入不含 `@server:uri` 的普通文本
- **THEN** 行为与既有一致：直接 `runTurn` 用户原文，不自动挂载 Resources
