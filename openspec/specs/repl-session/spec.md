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

REPL SHALL 识别以 `/` 开头的本地命令，不将其作为模型输入。

#### Scenario: /exit 退出

- **WHEN** 用户输入 `/exit` 或 `/quit`
- **THEN** REPL 正常退出，退出码 0

#### Scenario: /clear 清空会话

- **WHEN** 用户输入 `/clear`
- **THEN** `QueryEngine` 消息历史清空，并打印简短确认

#### Scenario: /help 显示帮助

- **WHEN** 用户输入 `/help`
- **THEN** 打印可用 slash 命令列表

### Requirement: REPL 流式输出

REPL SHALL 与 headless 模式使用相同的流式输出约定（text → stdout，工具状态 → stderr）。

#### Scenario: 工具状态在 REPL 中可见

- **WHEN** REPL 会话中 Agent 调用 Read 工具
- **THEN** stderr 打印 `[工具] Read: path` 格式状态行

