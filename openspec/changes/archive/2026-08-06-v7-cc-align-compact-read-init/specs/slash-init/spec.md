## MODIFIED Requirements

### Requirement: /init slash 命令

REPL SHALL 支持本地 slash 命令 `/init`。调用时 SHALL 向会话注入 init 引导材料（固定 prompt，可选附带用户 args），并发起一轮模型查询，使模型能够探索仓库并创建或更新项目上下文文件。SHALL NOT 将 `/init` 原文当作普通用户闲聊发送而不注入引导。

引导正文 SHALL 对齐 Claude Code `OLD_INIT_PROMPT`（仅将目标文件名按仓库策略替换为 `AGENTS.md` 或 `CLAUDE.md`）。SHALL NOT 默认采用依赖 AskUserQuestion / 访谈 UI 的 `NEW_INIT_PROMPT`（属非目标）。

系统 MAY 在 OLD_INIT 正文外追加简短 host note（平台差异 / Non-Goals），且 SHALL NOT 改写 OLD_INIT 既有语义；host note SHALL 指示通过阅读配置发现测试命令，禁止在 `/init` 中执行全量测试套件或长耗时 typecheck。

#### Scenario: /init 触发引导轮

- **WHEN** 用户输入 `/init`
- **THEN** 系统注入 init 引导内容并启动 `runTurn`（或等价查询），而非仅打印帮助

#### Scenario: 引导对齐 OLD_INIT

- **WHEN** 系统构建 `/init` 注入材料
- **THEN** 正文来自 CC `OLD_INIT_PROMPT` 结构（含收集 build/lint/test 命令、只写非显然信息等约束），目标文件名按策略替换

#### Scenario: host note 禁止跑全量测试

- **WHEN** 注入材料包含 host note
- **THEN** 明确要求发现测试命令靠读配置，不执行全量测试 / 长 typecheck

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
