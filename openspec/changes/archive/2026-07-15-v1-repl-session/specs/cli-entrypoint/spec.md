## MODIFIED Requirements

### Requirement: CLI 入口

系统 SHALL 提供 `src/entrypoints/cli.ts` 作为命令行入口，可通过 `bun run` 启动。

#### Scenario: 命令行参数模式

- **WHEN** 用户执行 `bun run dev -- "你的问题"`
- **THEN** CLI 将引号内文本作为用户消息启动 Agent 并输出回复

#### Scenario: Pipe 模式

- **WHEN** 用户执行 `echo "你的问题" | bun run dev -p`（或等效 pipe 标志）
- **THEN** CLI 从 stdin 读取用户消息并输出 Agent 回复到 stdout

#### Scenario: REPL 模式

- **WHEN** 用户执行 `bun run dev` 且未提供问题参数、未使用 `-p`
- **THEN** CLI 进入交互 REPL 而非打印用法并退出
