## Why

`react-agent-mini` 目前仅有脚手架与 Agent 技能配置，缺少可运行的 ReAct 核心。需要在空仓库中实现一个**可运行、可扩展**的最小 Agent 循环，架构对齐 claude-code-best 的 `query.ts` / `Tool.ts` 分层，以便后续逐步接入权限、压缩、MCP 等能力。模型侧优先对接 DeepSeek（OpenAI 兼容 API），降低初期 API 成本与接入门槛。

## What Changes

- 新增 Bun + TypeScript 项目骨架（`package.json`、`tsconfig.json`、开发/运行脚本）
- 实现核心 ReAct 循环：`query.ts`（async generator）+ `query/deps.ts` 依赖注入
- 定义 `Tool.ts` 工具契约及 `ToolUseContext`（精简版）
- 内置两个 v0 工具：**Echo**（验证闭环）、**Read**（读文件）
- 实现 OpenAI 兼容 Provider 适配层，对接 **DeepSeek**（内部消息仍使用 Anthropic 形态的 `tool_use` / `tool_result`）
- 提供 headless CLI 入口（pipe / 单次问答模式）
- v0 权限策略：全部 auto-allow（无交互确认）
- 新增中文架构文档 `docs/architecture.md` 及 multi-context 领域文档骨架
- 核心源码附中文注释

## Capabilities

### New Capabilities

- `react-loop`：ReAct 多轮对话循环（模型调用 → 工具执行 → 消息追加 → 递归），含 `maxTurns` 终止与流式事件 yield
- `tool-system`：工具注册、查找、串行执行（`runTools` / `runToolUse`），Echo 与 Read 工具实现
- `deepseek-provider`：DeepSeek（OpenAI Chat Completions）流式调用与消息/工具格式双向适配
- `cli-entrypoint`：命令行入口，支持 pipe 模式传入用户问题并输出 Agent 回复

### Modified Capabilities

（无——仓库尚无既有 spec）

## Impact

- **新增目录**：`src/`（query、tools、services/api、types、entrypoints）、`docs/architecture.md`
- **依赖**：`openai`（DeepSeek 兼容）、`zod`（工具 input schema）、TypeScript strict
- **环境变量**：`OPENAI_API_KEY`、`OPENAI_BASE_URL`（`https://api.deepseek.com`）、`OPENAI_MODEL`（默认 `deepseek-chat`）
- **运行时**：Bun（与 claude-code-best 一致）
- **不影响**：现有 `.cursor/skills/` 与 `docs/agents/` 配置
