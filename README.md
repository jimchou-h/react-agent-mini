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

### Mock 模式（无需 API Key）

验证 Echo 工具闭环：

```powershell
# Windows PowerShell
npx bun run dev:mock -- "用 Echo 回复 hello"
```

```bash
# macOS / Linux
bun run dev:mock -- "用 Echo 回复 hello"
```

### 真实 DeepSeek

```bash
bun run dev -- "读取 README.md 并一句话总结"
```

### Pipe 模式

从 stdin 读入**一条**问题（答完退出，非交互 REPL）：

```bash
echo "用 Echo 回复 hello" | bun run dev:mock -p
```

```powershell
"用 Echo 回复 hello" | npx bun run dev:mock -p
```

> 带 `-p` 时不要用 `dev:mock -- "问题" -p` 混用；`-p` 会忽略 argv 中的问题并等待 stdin。

## 脚本

| 命令 | 说明 |
|------|------|
| `bun run dev` | 运行 CLI（真实模型） |
| `bun run dev:mock` | 运行 CLI（`QUERY_MOCK=1`） |
| `bun test` | 单元 / 集成测试 |
| `bun run typecheck` | TypeScript 严格检查 |

## 文档

- [架构导读](docs/architecture.md) — ReAct 流程、模块职责、扩展路线
- [CONTEXT-MAP.md](CONTEXT-MAP.md) — 各模块术语表索引

## 架构速览

```
用户问题 → cli.ts → query() 循环
              ↓
         callModel (DeepSeek / mock)
              ↓
         tool_use? → runTools (Echo / Read)
              ↓
         流式 text_delta → stdout
         工具状态 → stderr
```

v0 为 **headless 单次问答**，不含 claude-code 式交互 REPL。
