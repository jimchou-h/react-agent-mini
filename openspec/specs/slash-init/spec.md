# slash-init Specification

## Purpose
TBD - created by archiving change v7-slash-init. Update Purpose after archive.
## Requirements
### Requirement: /init slash 命令

REPL SHALL 支持本地 slash 命令 `/init`。调用时 SHALL 向会话注入 init 引导材料（固定 prompt，可选附带用户 args），并发起一轮模型查询，使模型能够探索仓库并创建或更新项目上下文文件。SHALL NOT 将 `/init` 原文当作普通用户闲聊发送而不注入引导。

#### Scenario: /init 触发引导轮

- **WHEN** 用户输入 `/init`
- **THEN** 系统注入 init 引导内容并启动 `runTurn`（或等价查询），而非仅打印帮助

#### Scenario: help 列出 /init

- **WHEN** 用户输入 `/help`
- **THEN** 帮助文本包含 `/init` 说明

### Requirement: /init 产出项目上下文文件

在 `/init` 引导下，模型被指示创建或更新与加载器兼容的项目上下文文件（`AGENTS.md` 和/或 `CLAUDE.md`）。文件写入 SHALL 仍经过现有 Write/Edit 权限流程。

#### Scenario: 无上下文文件时生成

- **WHEN** 仓库尚无 `AGENTS.md`/`CLAUDE.md`，且 `/init` 轮次中模型成功写入约定默认文件
- **THEN** 该文件落在项目约定位置，可供后续 `loadProjectContext` 加载

#### Scenario: 已存在时改进

- **WHEN** 已存在项目上下文文件
- **THEN** init 引导要求改进既有内容，而非无视已有文件重复堆砌空话

