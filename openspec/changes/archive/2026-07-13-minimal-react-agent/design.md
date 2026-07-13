## Context

`react-agent-mini` 是面向学习的精简 Agent 仓库，目标是在 claude-code-best 架构约束下实现最小可运行 ReAct 循环。当前仓库无 `src/` 源码，仅有 Agent 技能与 `docs/agents/` 配置。

参考实现为 claude-code 的 `src/query.ts`（~2000 行），其核心为：

```
while (true):
  callModel → assistant + tool_use?
  if 无 tool_use → 完成
  runTools → tool_result
  messages += assistant + tool_results → continue
```

v0 剥离 compact、权限 UI、MCP、流式工具执行、hooks 等，但保留**目录布局与类型签名**以便后续扩展。

模型选用 DeepSeek（`https://api.deepseek.com`，OpenAI Chat Completions 协议）。内部消息统一为 Anthropic 形态（`tool_use` / `tool_result`），由 Provider 适配层做双向转换——与 claude-code `services/api/openai/` 策略一致。

## Goals / Non-Goals

**Goals:**

- 实现可运行的 headless CLI：`bun run dev -- "问题"` 或 pipe 模式
- ReAct 循环可通过 Echo 与 Read 工具完成多轮 tool call
- 架构模块与 claude-code-best 同构：`query.ts`、`Tool.ts`、`query/deps.ts`、`services/tools/orchestration.ts`、`services/api/`
- 源码与 `docs/architecture.md` 使用中文注释/文档
- TypeScript strict，Bun 运行时
- v0 权限：恒 auto-allow

**Non-Goals:**

- Ink REPL / 交互式权限弹窗
- Anthropic 原生 API、Bedrock、Vertex 等多 Provider
- DeepSeek thinking/reasoner 模式（`deepseek-reasoner`）
- Bash / Write / MCP / Agent 子任务
- 上下文压缩（compact）、token 预算、Langfuse
- 并发工具执行（v0 串行即可）
- 单元测试套件（可在 follow-up change 补充）

## Decisions

### 1. 内部消息格式：Anthropic 形态 + Provider 适配层

**选择**：`query` 循环只处理 `tool_use` / `tool_result` 块；DeepSeek 调用在 `services/api/openai/` 适配。

**理由**：与 claude-code-best 对齐，后续换 Provider 不改 `query.ts`。

**备选**：query 直接使用 OpenAI `tool_calls` 格式——实现更短，但扩展时需重写循环。

### 2. 依赖注入：`query/deps.ts`

**选择**：`QueryDeps = { callModel, uuid }`，生产默认绑定真实实现，测试可注入 fake。

**理由**：claude-code 已验证此模式，避免 `mock.module` 全局污染。

### 3. 工具：Echo + Read

**选择**：
- `Echo`：原样返回 `message`，验证 ReAct 闭环
- `Read`：`fs.readFile`，限制单文件 100KB，路径必须为存在的文件

**理由**：只读、跨平台一致、无 shell 风险。

### 4. 工具执行：串行 `runTools`

**选择**：v0 不实现 `partitionToolCalls` 并发分区。

**理由**：Echo/Read 均为只读；串行逻辑简单，orchestration 文件预留扩展点。

### 5. 循环终止信号：`needsFollowUp`

**选择**：流式解析时若出现 `tool_use` 块则 `needsFollowUp = true`；不依赖 `stop_reason === 'tool_use'`（claude-code 注释标明其不可靠）。

### 6. DeepSeek 配置

**选择**：复用 claude-code 环境变量惯例：

| 变量 | 默认值 |
|------|--------|
| `OPENAI_API_KEY` | （必填） |
| `OPENAI_BASE_URL` | `https://api.deepseek.com` |
| `OPENAI_MODEL` | `deepseek-chat` |

**理由**：用户可能已有配置；与 claude-code OpenAI 兼容层一致。

### 7. 目录结构

```
src/
├── entrypoints/cli.ts
├── query.ts
├── query/
│   ├── deps.ts
│   └── types.ts          # QueryParams, Terminal, State
├── Tool.ts
├── tools/
│   ├── EchoTool.ts
│   ├── ReadTool.ts
│   └── index.ts
├── services/
│   ├── api/
│   │   ├── client.ts     # callModel 入口
│   │   └── openai/
│   │       ├── adapter.ts
│   │       └── stream.ts
│   └── tools/
│       ├── orchestration.ts
│       └── execution.ts
├── types/message.ts
└── utils/messages.ts
```

### 8. 领域文档（Multi-context）

根目录新增 `CONTEXT-MAP.md`，指向：

- `src/query/CONTEXT.md` — ReAct 循环术语
- `src/tools/CONTEXT.md` — 工具系统术语
- `src/services/api/CONTEXT.md` — Provider 术语

`docs/architecture.md` 为中文导读。

### 9. `query()` 签名

**选择**：`async function* query(params): AsyncGenerator<StreamEvent | Message, Terminal>`

**理由**：与 claude-code 一致，CLI 可逐条消费 yield 的事件做流式输出。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| DeepSeek 流式 `tool_calls` 分片组装复杂 | 参考 claude-code `openai/index.ts` 增量解析；v0 可先非流式验证再补流式 |
| Read 路径遍历（`../../etc/passwd`） | 解析为绝对路径后校验落在 `cwd` 子树内 |
| 大文件撑爆 context | Read 硬限 100KB，超出返回工具错误 |
| 适配层与 claude-code 行为漂移 | 文档标明 v0 子集；关键场景手工验收 |
| 无测试回归 | proposal 标注 follow-up；tasks 含 smoke 验收步骤 |

## Migration Plan

不适用（绿field 项目）。部署步骤：

1. `bun install`
2. 配置 `OPENAI_API_KEY` 等环境变量
3. `bun run dev -- "读取 README 并总结"`

回滚：删除 `src/` 及本次新增依赖即可。

## Open Questions

- （已关闭）工具组合 → Echo + Read
- （已关闭）Provider → DeepSeek via OpenAI 兼容
- （已关闭）权限 → v0 auto-allow
- 流式输出粒度：v0 CLI 按 token 打印还是按完整 assistant 消息打印？→ 建议按 text delta 流式打印，工具结果整段输出
