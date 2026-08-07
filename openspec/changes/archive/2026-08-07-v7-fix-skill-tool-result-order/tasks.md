## 1. 回归测试（先红）

- [x] 1.1 `orchestration`：Skill 成功时 updates 顺序为 tool_result → 注入 text
- [x] 1.2 `messagesToOpenAI`：Skill 轮次出站为 assistant → role:tool → user(正文)
- [x] 1.3 `skill.smoke`：第二轮 `callModel` 历史中 tool_result 先于 Skill 正文

## 2. 实现

- [x] 2.1 `runTools`：先 yield `update.message`（tool_result），再 yield `prependMessages`
- [x] 2.2 更新 `Tool.ts` / `execution.ts` / `SkillTool.ts` / orchestration 注释（语义：tool_result 之后附加）
- [x] 2.3 修正 `adapter.test.ts` 中 `toolsToOpenAI` 工具数量（含 WebSearch/WebFetch）

## 3. 验证

- [x] 3.1 `bun test` 覆盖 orchestration / adapter / skill.smoke / SkillTool
- [x] 3.2 手工：REPL `/clear` 后让模型调用 Skill，确认无 400，并可继续对话
