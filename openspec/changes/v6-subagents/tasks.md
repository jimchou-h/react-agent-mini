## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#91](https://github.com/jimchou-h/react-agent-mini/issues/91) Agent nested query + summary | 1.1–1.2, 2.1 happy path | — |
| [#92](https://github.com/jimchou-h/react-agent-mini/issues/92) depth guard, no nested Agent, permission | 2.1 guards + 2.2 | #91 |
| [#93](https://github.com/jimchou-h/react-agent-mini/issues/93) docs + verify | 3.1–3.2 | #92 |

## 1. 嵌套上下文

- [x] 1.1 `ToolUseContext.depth` + `createSubagentContext`（abort 链、depth+1）；与 `query({ depth })` 统一 + 单测
- [x] 1.2 子会话独立 messages 跑 `query()`；摘要取末条 assistant text（截断）；失败 is_error + 单测

## 2. Agent 工具

- [x] 2.1 实现并注册 `Agent`（必填 description/prompt；可选 tool_names；子池排除 Agent；maxDepth）+ 单测
- [x] 2.2 权限派生：父 deny 对子生效；失败 tool_result 不污染父历史全文 + 单测

## 3. 文档与验收

- [x] 3.1 README / CONTEXT：depth、排除 Agent、非目标（无 swarm / SubagentStop）
- [x] 3.2 `bun test` + typecheck；mock 下父调 Agent 得摘要
