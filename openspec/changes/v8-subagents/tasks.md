## 1. 嵌套上下文

- [ ] 1.1 `ToolUseContext` 增加 depth / 派生 abort；超深拒绝 + 单测
- [ ] 1.2 子会话独立 messages 跑 `query()`，汇总文本回传 + 单测（mock callModel）

## 2. Agent 工具

- [ ] 2.1 实现并注册 `Agent` 工具（prompt 入参；可选工具子集）
- [ ] 2.2 权限派生：父 deny 对子生效；失败 tool_result 不污染父历史全文

## 3. 文档与验收

- [ ] 3.1 README / CONTEXT：深度限制、非目标（无 swarm）
- [ ] 3.2 `bun test` + typecheck；mock 下父调 Agent 得摘要
