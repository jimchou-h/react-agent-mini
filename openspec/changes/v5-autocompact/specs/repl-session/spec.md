## MODIFIED Requirements

### Requirement: Slash 命令

REPL SHALL 识别以 `/` 开头的本地命令，不将其作为模型输入。除内置 `/exit`、`/clear`、`/help`、`/compact` 外，SHALL 支持 MCP prompt slash 命令（形式 `/<server>:<prompt> (MCP) [args...]`，或省略 `(MCP)` 的 `/<server>:<prompt> [args...]`）。

#### Scenario: /exit 退出

- **WHEN** 用户输入 `/exit` 或 `/quit`
- **THEN** REPL 正常退出，退出码 0

#### Scenario: /clear 清空会话

- **WHEN** 用户输入 `/clear`
- **THEN** `QueryEngine` 消息历史清空，并打印简短确认

#### Scenario: /help 显示帮助

- **WHEN** 用户输入 `/help`
- **THEN** 打印可用 slash 命令列表（含 `/compact` 与已连接的 MCP prompt 命令）

#### Scenario: MCP slash 按 @server:uri 挂载后执行 prompt

- **WHEN** 用户输入 `/myserver:greet (MCP) arg1` 或 `/myserver:greet arg1` 且该 MCP prompt 已注册
- **THEN** Host 先 `prompts/get`，再仅挂载结果文本中 `@server:uri` 命中的资源（若有）；无引用则不自动挂载 Resources；再将 prompt 结果注入当前 turn；不将原始 slash 行作为 user 消息

#### Scenario: 未知 slash 提示

- **WHEN** 用户输入未知 `/foo` 且非 MCP 命令
- **THEN** 打印提示，不送模型

## ADDED Requirements

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
