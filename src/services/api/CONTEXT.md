# services/api 模块术语表

模型 Provider 与 DeepSeek（OpenAI 兼容）适配层。源码：`src/services/api/`。

## 设计原则

**内部 Anthropic 形态，外部 OpenAI 协议**：`query` 循环只认识 `tool_use` / `tool_result`；与 DeepSeek 的格式转换集中在本目录。

## 核心 API

| 术语 | 英文 | 说明 |
|------|------|------|
| **callModel** | `callModel()` | Provider 入口；`AsyncGenerator` 流式输出 |
| **mockEchoCallModel** | mock provider | `QUERY_MOCK=1` 时使用，规则匹配 Echo 场景 |
| **readOpenAIConfig** | config reader | 从环境变量读取 Key / baseURL / model |
| **assertOpenAIApiKey** | key guard | Key 缺失时抛错，CLI 启动前也会检查 |

## 适配层（openai/）

| 术语 | 文件 | 说明 |
|------|------|------|
| **messagesToOpenAI** | `adapter.ts` | 内部 `Message[]` → OpenAI `messages` |
| **toolsToOpenAI** | `adapter.ts` | `Tool[]` → OpenAI `tools` JSON schema |
| **openAIToAssistant** | `adapter.ts` | 非流式 completion → `AssistantMessage` |
| **parseOpenAIStream** | `stream.ts` | SSE 流解析：`text_delta`、增量 `tool_calls` 组装 |

## 流式事件

| 术语 | 说明 |
|------|------|
| **text_delta** | 模型文本增量，`{ type: 'text_delta', text }` |
| **assistant** | 完整 assistant 消息，含 `text` 与/或 `tool_use` 块 |
| **tool_calls 分片** | OpenAI 流式 `tool_calls` 按 index 增量合并为完整 `tool_use` |

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | — | API Key（真实模式必填） |
| `OPENAI_BASE_URL` | `https://api.deepseek.com` | 兼容端点，可换 Ollama 等 |
| `OPENAI_MODEL` | `deepseek-chat` | 模型 ID |
| `QUERY_MOCK` | — | `1` 跳过真实 API |

## 与 claude-code 对齐点

| react-agent-mini | claude-code |
|------------------|-------------|
| `services/api/openai/adapter.ts` | 同名目录，消息/工具双向转换 |
| `services/api/openai/stream.ts` | 流式解析与 tool_calls 组装 |
| `services/api/client.ts` | 多 Provider 路由前的统一入口 |

v0 仅 DeepSeek 单 Provider；claude-code 另有 `bedrock`、`vertex`、`gemini`、`grok` 等，扩展时新增子目录 + `providers.ts` 路由，**不改** `query.ts`。

## 关键文件

| 文件 | 职责 |
|------|------|
| `client.ts` | `callModel`、OpenAI 客户端缓存 |
| `mock.ts` | 本地验收用假模型 |
| `openai/adapter.ts` | 格式转换 |
| `openai/stream.ts` | 流式解析 |
