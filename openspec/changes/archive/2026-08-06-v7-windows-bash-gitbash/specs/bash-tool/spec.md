## ADDED Requirements

### Requirement: Windows 上 Bash 使用 Git Bash

在 `win32` 上，`Bash` 工具 SHALL 通过 Git Bash（`bash.exe`）执行命令，SHALL NOT 使用 `cmd.exe` / `ComSpec` 作为执行器。非 Windows 平台行为保持既有：使用 `SHELL` 或 `/bin/bash` 与 `-c`。

解析顺序 SHALL 至少包含：环境变量 `CLAUDE_CODE_GIT_BASH_PATH`（若指向可用可执行文件）→ 已是 bash 的 `SHELL` → 常见 Git for Windows 安装位置 / 从 `git` 可执行文件推断的 `bash.exe`。

#### Scenario: Windows 用 bash 执行 Unix 语法

- **WHEN** 在 `win32` 且已解析到可用 `bash.exe`，模型调用 `Bash` 执行如 `echo hello && pwd` 的 Unix 风格命令且权限 allow
- **THEN** 命令由该 bash 执行并以退出码 0 返回可识别输出（非 cmd 方言错误）

#### Scenario: Windows 找不到 Git Bash

- **WHEN** 在 `win32` 且无法解析到可用 `bash.exe`
- **THEN** `Bash` 调用返回 `isError`（或等价错误语义），文案提示安装 Git for Windows 或设置 `CLAUDE_CODE_GIT_BASH_PATH`，SHALL NOT 静默改用 `cmd.exe`

#### Scenario: 非 Windows 不变

- **WHEN** 在非 `win32` 平台调用 `Bash`
- **THEN** 仍通过既有 POSIX shell（`SHELL` 或 `/bin/bash`）以 `-c` 执行，行为与本 change 前一致

### Requirement: 向模型声明 Unix shell 语法

系统 SHALL 在 `Bash` 工具描述和/或会话 system 上下文中声明：即使运行在 Windows，命令亦使用 Unix/bash 语法（例如正斜杠路径、`/dev/null` 而非 `NUL`）。

#### Scenario: 工具描述含平台提示

- **WHEN** 检查已注册的 `Bash` 工具 `description`（或注入的 shell 信息行）
- **THEN** 文本明确要求使用 Unix/bash 语法，而非 cmd/PowerShell 方言

## MODIFIED Requirements

### Requirement: Bash 工具

系统 SHALL 提供 `Bash` 工具，在当前工作目录执行一条 shell 命令并返回捕获的输出。可选超时字段 SHALL 为 `timeout`（毫秒）。未指定时默认超时 SHALL 为 120000 ms。在 Windows 上执行器 SHALL 为 Git Bash（见「Windows 上 Bash 使用 Git Bash」）；在其他平台 SHALL 为 POSIX shell。

#### Scenario: 成功执行并返回输出

- **WHEN** 模型调用 `Bash` 且权限 allow、命令在超时内以退出码 0 结束
- **THEN** `tool_result` 包含命令输出（或明确的空输出说明），文件/进程副作用以命令为准

#### Scenario: 非零退出码

- **WHEN** 命令结束且退出码非 0
- **THEN** `tool_result` 标记为错误（或等价失败语义），并尽可能包含已捕获的 stdout/stderr，便于模型诊断

#### Scenario: 超时

- **WHEN** 命令超过配置的 `timeout`（含默认值与硬顶）
- **THEN** 系统终止该进程（尽力而为），`tool_result` 标记为错误并说明超时

#### Scenario: 输出截断

- **WHEN** 捕获输出超过配置的字符上限
- **THEN** 返回内容截断并附截断说明，不因输出过大而拖垮上下文

#### Scenario: 非只读

- **WHEN** 检查 `BashTool.isReadOnly`
- **THEN** 返回 `false`
