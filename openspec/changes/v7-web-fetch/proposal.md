## Why

搜索结果常需打开具体页面核对。Claude Code 有配套 `WebFetch`；mini 对齐其精简子集，形成「搜索 → 读页」闭环。

## What Changes

- 新增内置工具 `WebFetch`（必填 `url`）
- 默认 HTTP 直取并抽取可读文本/Markdown；超时与大小上限
- 基础 SSRF/域名护栏（拒绝明显危险目标）
- 注册进 `getTools()`；支持 abort signal
- 文档说明与 `WebSearch` 的配合关系

## Capabilities

### New Capabilities

- `web-fetch`: 按 URL 拉取网页正文的工具契约

### Modified Capabilities

- `tool-system`: 注册 `WebFetch`

## Impact

- 新增 fetch 工具与安全默认值
- 可不依赖 Tavily Extract；后续可加 adapter
- 无 BREAKING
