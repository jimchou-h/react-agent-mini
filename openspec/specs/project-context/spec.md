# project-context Specification

## Purpose

发现并加载项目级 Markdown（AGENTS.md / CLAUDE.md），作为 system prompt 注入模型调用；缺失时静默跳过。

## Requirements

### Requirement: 项目上下文发现

系统 SHALL 从当前工作目录起发现项目级 Markdown 上下文文件（`AGENTS.md` 与/或 `CLAUDE.md`）。

#### Scenario: cwd 存在 AGENTS.md

- **WHEN** `cwd` 下存在 `AGENTS.md`
- **THEN** 加载其 UTF-8 内容作为项目上下文的一部分

#### Scenario: 仅存在 CLAUDE.md

- **WHEN** `cwd` 无 `AGENTS.md` 但存在 `CLAUDE.md`
- **THEN** 加载 `CLAUDE.md` 内容

#### Scenario: 均不存在

- **WHEN** 查找路径上无上述文件
- **THEN** 系统不注入项目上下文，且不因此失败退出

### Requirement: 上下文注入 callModel

系统 SHALL 将已加载的项目上下文作为 system prompt 传给模型调用。

#### Scenario: 出站含 system 消息

- **WHEN** 已加载非空项目上下文并发起 `callModel`
- **THEN** OpenAI 请求 messages 数组首位为 `role: system`，内容含该上下文

#### Scenario: /clear 后仍保留 system

- **WHEN** REPL 用户执行 `/clear` 清空对话历史
- **THEN** 后续 turn 的 system prompt 仍包含项目上下文
