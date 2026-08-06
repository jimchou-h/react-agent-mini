## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#97](https://github.com/jimchou-h/react-agent-mini/issues/97) WebSearch + mock/default adapter | 1.1–1.2, 2.1 happy | — |
| [#99](https://github.com/jimchou-h/react-agent-mini/issues/99) missing key / abort + docs | 2.1 rest + 2.2 | #97 |

## 1. Adapter + Tool

- [x] 1.1 定义搜索 adapter 接口与 mock；实现默认 adapter（Brave 或 Tavily）
- [x] 1.2 实现 `WebSearch` 工具（query 校验、格式化结果、缺 Key 错误、signal）

## 2. 注册与验收

- [x] 2.1 注册到 `getTools()`；单测覆盖成功/缺 Key/abort
- [x] 2.2 README / CONTEXT：配置项与非目标
