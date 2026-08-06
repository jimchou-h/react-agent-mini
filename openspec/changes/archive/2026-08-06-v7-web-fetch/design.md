## Context

CC `WebFetch` 可与搜索配套。mini 先做 HTTP 直取精简版。

## Goals / Non-Goals

**Goals:** `WebFetch(url)`；超时/大小限制；文本抽取；abort。

**Non-Goals:** 完整浏览器渲染、登录态站点、Tavily Extract 默认绑定。

## Decisions

1. 工具名 `WebFetch`；只读。
2. 默认 `http` adapter：fetch → 去标签/保留 Markdown 友好文本。
3. 拒绝非 http(s)、明显内网/元数据地址（基础 SSRF 护栏）。
4. 超限截断并标明。

## Risks / Trade-offs

- [SSRF] → 默认拒绝私网与 link-local
- [编码/二进制] → 非文本失败或短错误

## Open Questions

无阻塞项。
