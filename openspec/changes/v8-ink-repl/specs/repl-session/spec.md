## MODIFIED Requirements

### Requirement: 交互 REPL 循环

系统 SHALL 在无 CLI 问题参数时启动 **Ink** 交互 REPL，展示输入区并循环接受用户输入（不再以 `node:readline` 的 `> ` 提示符作为主循环）。

#### Scenario: 无参数启动 REPL

- **WHEN** 用户执行 `bun run dev`（或 `dev:mock`）且未传问题文本、未使用 `-p`
- **THEN** 进入 Ink REPL，显示 PromptInput 并等待输入

#### Scenario: 连续多轮对话

- **WHEN** 用户在 REPL 中连续输入两条不同问题
- **THEN** 每轮均调用 Agent 并输出回复，且第二轮可访问第一轮对话历史

#### Scenario: 空行跳过

- **WHEN** 用户只按回车提交空行
- **THEN** 不发起 query，继续等待输入

### Requirement: REPL 流式输出

Ink REPL SHALL 通过消费 `query` / `QueryEngine.runTurn` 的 yields 更新界面（助手文本、工具状态）。headless / pipe 模式 SHALL 继续使用既有终端流式约定（text → stdout，工具状态 → stderr）。Ink REPL SHALL NOT 依赖与 headless 相同的默认 `process.stdout.write` delta 路径作为主展示。

#### Scenario: 工具状态在 REPL 中可见

- **WHEN** Ink REPL 会话中 Agent 调用 Read 工具
- **THEN** 界面展示 Read 工具开始摘要（不必再要求 stderr `[工具] Read: path` 格式为唯一通道）

#### Scenario: headless 工具状态不变

- **WHEN** headless / pipe 模式 Agent 调用 Read
- **THEN** 仍在 stderr 打印既有 `[工具] Read: …` 风格状态行
