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
| `/exit` 或 `/quit` | 退出 |

> 若曾设置 `$env:QUERY_MOCK="1"`，请先 `Remove-Item Env:QUERY_MOCK`，否则会一直走仅 Echo 的 mock。

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
用户 → cli.ts → QueryEngine.runTurn / query()
                      ↓
                 callModel (DeepSeek / mock)
                      ↓
                 tool_use? → runTools
                      ↓
                 text → stdout；工具状态 → stderr
```

支持 **交互 REPL（多轮）** 与 **headless / pipe（单次）**。
