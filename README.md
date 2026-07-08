# react-agent-mini

最简 ReAct Agent（对齐 claude-code-best 架构）。

## 环境

- [Bun](https://bun.sh)（未全局安装时可用 `npx bun`）

## 快速开始（Mock 模式，无需 API Key）

**Windows PowerShell（推荐）：**

```powershell
npx bun run dev:mock -- "用 Echo 回复 hello"
```

**macOS / Linux：**

```bash
QUERY_MOCK=1 bun run dev -- "用 Echo 回复 hello"
# 或
bun run dev:mock -- "用 Echo 回复 hello"
```

## 测试

```bash
npx bun test
npx tsc --noEmit
```

## 说明

- `dev:mock`：使用内置 mock 模型，验证 Echo 工具闭环（issue #1）
- `dev`：真实 DeepSeek 对话（issue #2 起，需 `OPENAI_API_KEY`）
