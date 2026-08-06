## Why

Claude Code 将联网检索做成内置 `WebSearch`，mini 目前只能靠 Bash/模型臆测，无法稳定获取时效信息。对齐 CC 的精简客户端搜索工具，让会话具备可中断、可测试的联网检索能力。

## What Changes

- 新增内置工具 `WebSearch`（必填 `query`；可选域名过滤与结果数）
- 先接入单一搜索 adapter（默认 Brave 或 Tavily，由 env/配置选择）
- 结果形态对齐 CC：`title` / `url` / `snippet?`
- 注册进 `getTools()`；透传 `abortController.signal`
- README / CONTEXT 文档化配置与非目标

## Capabilities

### New Capabilities

- `web-search`: 内置 WebSearch 工具与单 adapter 检索契约

### Modified Capabilities

- `tool-system`: 注册 `WebSearch`

## Impact

- 新增 `src/tools/WebSearchTool.ts`（或等价）与 adapter 模块
- 依赖外部搜索 API Key（环境变量）
- 无 BREAKING API；缺 Key 时工具应清晰失败而非静默
