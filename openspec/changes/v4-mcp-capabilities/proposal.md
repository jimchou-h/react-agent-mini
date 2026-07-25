## Why

v3 MCP 只接了 Tools + stdio。概念 blog 已讲六大能力，但仓库 Host 侧仍缺 Resources / Prompts 的最小接线，读者无法「在 Agent 里走一遍」。本 change 做**可演示的最小 Host 用法**（list/read resource、get prompt 注入），不扩 SSE/OAuth。

## What Changes

- MCP session：在已有 stdio 连接上支持 `resources/list` + `resources/read`（或 SDK 等价）
- 支持 `prompts/list` + `prompts/get`；将取得的 prompt 消息注入本轮或 system/user（设计选定一种简单路径）
- CLI 或只读工具暴露最小入口（如 `McpResource` / 文档化的 slash，择一，保持竖切可测）
- 示例：扩展现有 `examples/mcp-tour-server` 或文档指向；smoke
- **非目标**：Sampling、Roots、Elicitation、SSE/HTTP、OAuth

## Capabilities

### New Capabilities

- `mcp-resources`：资源发现与读取（经 Host）
- `mcp-prompts`：提示模板拉取与注入

### Modified Capabilities

- `mcp-client`：会话能力声明与生命周期覆盖 resources/prompts（若写在同一模块可 MODIFIED）

## Impact

- **修改**：`src/services/mcp/`、CLI 或工具、文档 / 概念篇交叉链接
- **Blog**：概念篇**补章**或「Host 怎么用 Resources/Prompts」短篇；不宜再写一篇重复「什么是 MCP」

## Blog 角度

| 要素 | 内容 |
|------|------|
| 钩子 | 「Tools 之外，材料（Resources）和开场白（Prompts）怎么进 Agent？」 |
| 隐喻 | 工具箱 vs 资料架 vs 提词器 |
| 演示 | tour server：挂资源 → 取 prompt → 再调 tool |
| 刻意不做 | 传输层 SSE、OAuth、Sampling 反向调模型 |
