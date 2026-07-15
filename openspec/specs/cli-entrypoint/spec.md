## Purpose

命令行入口：headless 单次问答、pipe 模式与无参数交互 REPL 的路由与终端输出。
## Requirements
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

### Requirement: 环境检查

CLI SHALL 在启动时检查 `OPENAI_API_KEY`，缺失时以非零退出码打印中文错误说明。

#### Scenario: 未配置 API Key

- **WHEN** `OPENAI_API_KEY` 为空
- **THEN** CLI 打印中文提示并 exit 1

### Requirement: 流式终端输出

CLI SHALL 将 `query()` yield 的 text delta 实时打印到终端，工具执行阶段打印简短中文状态提示。

#### Scenario: 工具执行提示

- **WHEN** Agent 正在执行 Read 工具
- **THEN** CLI 打印类似 `[工具] Read: path/to/file` 的状态行

#### Scenario: 完成输出

- **WHEN** Agent 循环以 `completed` 终止
- **THEN** CLI 以退出码 0 结束

