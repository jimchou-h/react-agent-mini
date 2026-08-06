## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#98](https://github.com/jimchou-h/react-agent-mini/issues/98) WebFetch HTTP text extract | 1.1–1.2, 2.1 happy | — |
| [#100](https://github.com/jimchou-h/react-agent-mini/issues/100) SSRF guard / abort + docs | error paths + 2.1/2.2 | #98 |

## 1. Fetch 核心

- [x] 1.1 URL 护栏 + HTTP 拉取 + 文本抽取/截断 + signal
- [x] 1.2 实现 `WebFetch` 工具与错误路径单测

## 2. 注册与文档

- [x] 2.1 注册 `getTools()`；与 WebSearch 文档交叉引用
- [x] 2.2 README / CONTEXT
