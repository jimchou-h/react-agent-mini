## ADDED Requirements

### Requirement: Vendored Anthropic Ink 运行时

交互 REPL SHALL 使用 workspace 包 `@anthropic/ink`（从 claude-code 同源树 vendor）作为终端 React 运行时。系统 SHALL NOT 以官方 npm `ink` 包作为 Ink REPL 主路径。

#### Scenario: 无参启动进入 Ink REPL

- **WHEN** 用户执行 `bun run dev`（或 `dev:mock`）且未传问题文本、未使用 `-p`
- **THEN** 进程基于 `@anthropic/ink` 渲染交互界面并等待输入

#### Scenario: headless 不依赖 Ink

- **WHEN** 用户以 headless 或 `-p` 启动
- **THEN** 不启动 Ink 根节点，行为与既有非交互模式一致

### Requirement: CC 对齐的 UI 树与 Host Bridge

Ink 应用 UI SHALL 放在 `src/ui/` 下，并采用与 claude-code 对齐的相对目录/模块职责（`screens/REPL`、`components/Messages`、`PromptInput`、`permissions` 等）。本仓引擎接线 SHALL 经 Host Bridge（或等价适配层）完成；UI 组件 SHALL NOT 直接依赖 `QueryEngine` 实现细节作为长期接缝。对本仓尚未具备的 CC UI 能力，系统 SHALL 提供 stub 或 feature 关闭，避免崩溃。

#### Scenario: 经 Bridge 完成一轮对话

- **WHEN** 用户在 PromptInput 提交普通问题
- **THEN** Host Bridge 调用本仓会话引擎完成 turn，并将助手流式文本与结果反映到 Messages/transcript

#### Scenario: 缺能力 stub 不崩溃

- **WHEN** UI 引用到本仓未实现的 CC 特性入口（如已 stub 的 plan/AskUserQuestion）
- **THEN** 表现安全降级（no-op、隐藏或提示不可用），进程不因此退出

### Requirement: Transcript 与流式

Transcript SHALL 至少展示：用户文本、助手文本（含流式未完成态）、工具调用摘要、工具结果（成功或错误）。Ink REPL SHALL 通过 Bridge 消费 yields 更新界面，SHALL NOT 以默认 `process.stdout.write` delta 作为主展示路径。

#### Scenario: 流式助手文本

- **WHEN** 模型产出 text delta
- **THEN** transcript 中当前助手消息可见增长且布局不被 stdout 直写破坏

#### Scenario: 工具调用可见

- **WHEN** 模型发出工具 `tool_use`
- **THEN** 界面显示该工具的开始摘要

### Requirement: 权限确认 UI

当 REPL `canUseTool` 需要确认时，系统 SHALL 展示 Ink 权限 UI。对能与本仓工具对齐的 CC 专用权限对话框 SHALL 迁入并优先使用；其余走 Fallback。键位/结果语义 SHALL 与 permission-pipeline / permission-rules 一致（含 `y` / `n` / `a`）。有待确认请求时 SHALL 防止 PromptInput 把草稿误提交为新 turn。

#### Scenario: 写工具确认

- **WHEN** 模型调用 Write 且规则未放行
- **THEN** 显示权限 UI（专用框或 Fallback）；用户确认允许后执行写入

#### Scenario: Bash 专用框可用时走专用 UI

- **WHEN** 模型调用 Bash 且已迁入对应权限对话框
- **THEN** 展示该专用权限 UI（而非仅通用纯文本提示），确认结果仍经 Bridge 作用于 `canUseTool`

#### Scenario: 确认期间不误提交

- **WHEN** 权限 UI 可见
- **THEN** Enter 不会将 PromptInput 草稿作为新的用户 turn 提交

### Requirement: Slash 建议与执行

PromptInput 在 `/` 前缀下 SHALL 提供与本仓可用命令一致的建议（内置、MCP prompt、Skill）。执行优先级 SHALL 仍为内置 → MCP → Skill → 未知。建议数据经 Host Bridge（或等价）来自本仓注册表，而非硬编码假列表。

#### Scenario: / 建议来自本仓

- **WHEN** 用户输入 `/he` 且存在内置 `/help`
- **THEN** 建议列表包含 `/help`

#### Scenario: 未知 slash

- **WHEN** 用户提交未知 `/foo`
- **THEN** 提示且不送模型，与既有语义一致

### Requirement: 状态行与 interrupt 入口

Ink REPL SHALL 在 turn 运行中显示进行中指示，并在轮次正常结束后展示上下文占用百分比。Interrupt（Ctrl+C）SHALL 经 Host/Ink 路径触发既有 idle/running/cleanup 三段语义。

#### Scenario: 运行中指示与 ctx %

- **WHEN** 用户完成一轮非 slash 对话
- **THEN** 运行中曾显示进行中指示，结束后可见 ctx % 提示

#### Scenario: 运行中 Ctrl+C

- **WHEN** turn 进行中用户第一次 interrupt
- **THEN** 本轮 abort，界面回到可输入状态

### Requirement: Transcript Markdown 渲染

Ink REPL 的 transcript SHALL 对助手消息（含流式未完成态）与用户文本消息按 Markdown（GFM 子集）渲染，至少支持：标题、粗体、斜体、行内代码、围栏代码块、列表、引用、链接。系统 SHALL NOT 将含 Markdown 语法的助手正文仅以未解析纯文本展示为唯一路径。

#### Scenario: 粗体与代码可见为格式化输出

- **WHEN** 助手消息包含 `**bold**` 与 `` `code` ``
- **THEN** 界面经 Markdown 渲染路径输出（非原样转义丢弃标记的唯一展示）

#### Scenario: 围栏代码块保留内容

- **WHEN** 助手消息含 fenced code block
- **THEN** 代码正文出现在 transcript 渲染结果中

### Requirement: Upstream pin 可升级

项目 SHALL 记录 UI/`@anthropic/ink` 的 upstream 来源与 pin（commit 或 tag），并具备可重复的同步说明，使后续对齐 CC 时以更新 vendor + 核对 Bridge/stub 为主要路径。

#### Scenario: 文档可定位 pin

- **WHEN** 维护者打开 upstream 说明文档
- **THEN** 可看到 ink/UI 的来源仓库标识与当前 pin 引用
