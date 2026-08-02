# react-agent-mini

最简 ReAct Agent，架构对齐 [claude-code-best](https://github.com/jimchou-h/claude-code)。内部消息为 Anthropic 形态（`tool_use` / `tool_result`），经 OpenAI 兼容层调用 DeepSeek。

## 安装

```bash
bun install
```

未全局安装 Bun 时，下文命令中的 `bun` 可替换为 `npx bun`。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENAI_API_KEY` | 真实模式是 | — | DeepSeek API Key |
| `OPENAI_BASE_URL` | 否 | `https://api.deepseek.com` | OpenAI 兼容 API 地址 |
| `OPENAI_MODEL` | 否 | `deepseek-chat` | 模型名称 |
| `QUERY_MOCK` | 否 | — | 设为 `1` 使用内置 mock（无需 Key） |
| `TRACE` | 否 | — | 设为 `1` 向 stderr 打印 `[trace]` 全链路日志 |
| `ALLOW_WRITE` | 否 | — | 设为 `1` 时 headless/pipe 允许写类工具（含非只读 MCP）；默认拒绝 |
| `MCP_CONFIG` | 否 | `<cwd>/.mcp.json` | MCP 配置路径；逗号分隔可合并多文件（后者覆盖同名 server） |
| `COMPACT` | 否 | 开启 | 设为 `0` 关闭出站裁剪与自动 LLM 摘要 |
| `AUTOCOMPACT` | 否 | 开启 | 设为 `0` 关闭自动 LLM 摘要（`/compact` 仍可用） |
| `AUTOCOMPACT_PERCENT` | 否 | `80` | 上下文占用达到该百分比时尝试自动摘要 |
| `CONTEXT_WINDOW_TOKENS` | 否 | `128000` | 估算 ctx % 时的窗口大小 |
| `COMPACT_THRESHOLD_CHARS` | 否 | `80000` | 确定性 microcompact / 保尾的出站字符阈值 |
| `HOOKS` | 否 | 开启 | 设为 `0` 跳过 `.agents/hooks.json` 中的生命周期 hooks |

### Hooks（PreToolUse / PostToolUse）

在项目根放置 `.agents/hooks.json`，可在权限通过后、工具 `call` 前后跑命令型 hook：

| 事件 | 时机 | 失败行为 |
|------|------|----------|
| **PreToolUse** | `call` 前 | `exit 2` 或 stdout JSON `permissionDecision: "deny"` → 不执行工具；其它非 0 默认 fail-soft（可设 `denyOnFailure`） |
| **PostToolUse** | `call` 后 | 只警告，不撤销已有 `tool_result` |

matcher 为工具名精确匹配或 `*`。命令经 shell 执行，stdin 为 JSON payload（含 `tool_name` / `tool_input` 等）。**命令可执行任意代码，只信任本工作区配置。**

示例见 [`examples/hooks/`](examples/hooks/)（拦 Bash + Post 打日志）。`TRACE=1` 时 stderr 有 `hooks.pre` / `hooks.post`。本版不做 Stop hook。讲解见 [`docs/blog/hooks.md`](docs/blog/hooks.md) · [CSDN](https://blog.csdn.net/weixin_43160044/article/details/163394425)。

### Write / Edit 权限（简要）

| 模式 | 行为 |
|------|------|
| REPL | Write/Edit 前询问 `y/N` |
| headless / pipe | 默认拒绝；`$env:ALLOW_WRITE="1"` 后允许 |

| 工具 | 何时用 |
|------|--------|
| **Write** | 新建文件，或整文件覆盖重写 |
| **Edit** | 改已知片段：`old_string` → `new_string`（默认唯一匹配；`replace_all` 可全量替换） |

PowerShell 设置示例：

```powershell
$env:OPENAI_API_KEY = "sk-..."
$env:OPENAI_BASE_URL = "https://api.deepseek.com"
```

## 快速开始

### 交互 REPL（默认）

无参数启动进入多轮会话（提示符 `> `）：

```powershell
npx bun run dev:mock
# 或
npx bun run dev:repl
```

```bash
bun run dev:mock
bun run dev:repl
```

REPL 内可用：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/clear` | 清空会话历史 |
| `/compact` | LLM 摘要压缩当前会话（打印压缩前后 `ctx ~NN%`） |
| `/memory` | 显示 Agent Memory 路径与长度（不 callModel） |
| `/exit` 或 `/quit` | 退出 |

> 若曾设置 `$env:QUERY_MOCK="1"`，请先 `Remove-Item Env:QUERY_MOCK`，否则会一直走仅 Echo 的 mock。

### 项目上下文（AGENTS.md / CLAUDE.md）

启动时从当前工作目录向上查找项目说明，并作为 **system prompt** 注入模型（不进入对话历史）：

| 规则 | 行为 |
|------|------|
| 文件名 | 优先同目录 `AGENTS.md`；可与 `CLAUDE.md` 合并（AGENTS 在前） |
| 缺失 | 静默跳过，不影响启动 |
| `/clear` | 只清空多轮对话；system 上下文仍保留 |
| 大小 | 合并后最多 64KB，超出截断 |

本仓库根目录的 `AGENTS.md` 会在真实模型模式下自动生效。Mock 模式仍会加载并透传 `systemPrompt`，但假模型不解读内容。

### Agent Memory（跨会话偏好）

可选文件 **`.agents/memory/MEMORY.md`**：启动时与项目说明一并注入 **system prompt**（顺序：AGENTS/CLAUDE → Memory 指引±正文 → Skills 目录摘要）。**即使文件缺失**也会注入路径与 remember 写法（对齐 claude-code memdir 精简版）。

| 规则 | 行为 |
|------|------|
| 路径 | 仅 `.agents/memory/MEMORY.md`（相对 cwd） |
| 大小 | 最多 32KB，超出截断 |
| 缺失 | 启动成功；system 仍含路径指引与「currently empty」说明 |
| 刷新 | REPL 每轮 `runTurn` 前按文件 mtime 刷新；未变则用缓存 |
| 写入 | 用既有 `Write` / `Edit` 写该文件（走 REPL 确认 / `ALLOW_WRITE`）；启动时 ensure `.agents/memory/` |
| `/memory` | 只读展示路径与字符数 |
| 与 compact | Memory 在 system 通道，**不替代** autocompact / `/compact` |

术语见 [`src/services/memory/CONTEXT.md`](src/services/memory/CONTEXT.md)。讲解见 [`docs/blog/memory.md`](docs/blog/memory.md)。

### Skills（按需工作流）

启动时扫描以下工作区目录一次：

- `.agents/skills/*/SKILL.md`
- `.claude/skills/*/SKILL.md`

每个 `SKILL.md` 可用 YAML frontmatter 声明 `name` 与 `description`；缺少 `name` 时使用目录名。可用技能摘要会加入 system prompt，模型通过只读 `Skill` 工具按名称加载正文。单技能正文最多 32KB，REPL `/clear` 不重新扫描。

**REPL slash：** `/<skill-id> [args...]`（`skill-id` = 目录名）。解析优先级：内置（`/help` `/clear` `/compact` …）→ MCP `/server:prompt` → Skill → 未知提示。无 args 只注入正文并打印确认（不 callModel）；有 args 则注入后以参数文本开一轮。与 `Skill` 工具共用同一调用 ID 与注入格式。

本仓库示例：

- `.agents/skills/echo-demo/SKILL.md`
- `.agents/skills/skill-creator/SKILL.md`（如何写项目 Skill）

```text
Skill({ "skill": "echo-demo" })
# 或 REPL：
/echo-demo
/skill-creator 帮我写一个 foo skill
```

### MCP（stdio 外部工具 + Resources + Prompts）

项目根放置 `.mcp.json`（可用 `MCP_CONFIG` 覆盖路径，支持逗号分隔多文件合并）即可在启动时连接 stdio MCP server：

- **Tools**：以 `mcp__<server>__<tool>` 合并进会话（`.` / 空格 → `_`）
- **Resources**：server 声明 `resources` 时，追加 `ListMcpResourcesTool` / `ReadMcpResourceTool` 供模型 list/read
- **Prompts**：server 声明 `prompts` 时，REPL 可用 `/server:prompt args`。Host 对 slash 返回文本与**普通/headless 用户消息**中的 `@server:uri` 按需挂载 Resource；无引用不自动挂载

博客分两篇：

- 概念（六大能力 + Demo）：[CSDN](https://blog.csdn.net/weixin_43160044/article/details/163114630) · [`docs/blog/mcp-concepts.md`](docs/blog/mcp-concepts.md)
- Tools 接线实现：[CSDN](https://blog.csdn.net/weixin_43160044/article/details/163081253) · [`docs/blog/mcp.md`](docs/blog/mcp.md)
- Resources / Prompts 接线：[`docs/blog/mcp-capabilities.md`](docs/blog/mcp-capabilities.md)

```bash
# 概念 tour：Tools + Resources + Prompts（API 分别打一遍）
node examples/mcp-tour-server/smoke.mjs
# Host 用法串起来：挂材料 → 取开场 → 调工具
node examples/mcp-tour-server/how-to-host.mjs

# 接进 Agent 的计算器
node examples/mcp-calc-server/smoke.mjs
cp .mcp.json.example .mcp.json
bun run dev   # 问：用计算器算 17+25

# tour server + REPL：/tour:plan_trip (MCP) Tokyo 3
# （.mcp.json 中 server key 须为 tour，与 prompt 内 @tour:docs://handbook 一致）
```

配置模板（与 `.mcp.json.example` 相同）：

```json
{
  "mcpServers": {
    "tour": {
      "command": "node",
      "args": ["examples/mcp-tour-server/server.js"]
    },
    "calc": {
      "command": "node",
      "args": ["examples/mcp-calc-server/server.js"]
    }
  }
}
```

| 规则 | 行为 |
|------|------|
| 无配置文件 | 跳过 MCP，仅内置工具（与 v2 一致） |
| 某 server 连接失败 | stderr 警告并跳过该 server |
| 权限 | 默认非只读，走与 Write 相同的 `canUseTool`（REPL y/n；headless 需 `ALLOW_WRITE=1`） |
| Resources | 只读工具；read 失败返回错误 tool_result |
| Prompts | 仅 REPL slash 执行模板；`@server:uri` 在 slash/普通消息/headless 均可按需挂载；不经 Skill 工具 |
| 限制 | 仅 stdio；无 SSE/OAuth/Sampling/`resources/subscribe` |

### Mock 单次问答（无需 API Key）

```powershell
npx bun run dev:mock -- "用 Echo 回复 hello"
```

```bash
bun run dev:mock -- "用 Echo 回复 hello"
```

### 真实 DeepSeek

```bash
bun run dev -- "读取 README.md 并一句话总结"
```

### Pipe 模式

从 stdin 读入**一条**问题（答完退出，非 REPL）：

```bash
echo "用 Echo 回复 hello" | bun run dev:mock -p
```

```powershell
"用 Echo 回复 hello" | npx bun run dev:mock -p
```

> 带 `-p` 时不要与 argv 问题混用；`-p` 会忽略 argv 中的问题并等待 stdin。

## 脚本

| 命令 | 说明 |
|------|------|
| `bun run dev` | CLI：无参数 = REPL；有参数 = headless |
| `bun run dev:mock` | 同上，强制 mock |
| `bun run dev:repl` | 显式进入 REPL |
| `bun test` | 单元 / 集成测试 |
| `bun run typecheck` | TypeScript 严格检查 |

## 文档

- [架构导读](docs/architecture.md) — ReAct 流程、模块职责、扩展路线
- [CONTEXT-MAP.md](CONTEXT-MAP.md) — 各模块术语表索引

## 架构速览

```
用户 → cli.ts → loadSessionContext() + loadMcpTools()
                    ├─ project context / skills
                    └─ MCP tools（可选）
                      ↓
              QueryEngine.runTurn / query()
                      ↓
                 callModel (DeepSeek / mock)
                      ↓
                 tool_use? → runTools（builtin + mcp__*）
                      ↓
                 text → stdout；工具状态 → stderr
```

支持 **交互 REPL（多轮）** 与 **headless / pipe（单次）**；项目上下文对三种模式均生效。
