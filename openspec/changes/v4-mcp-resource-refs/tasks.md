## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#71](https://github.com/jimchou-h/react-agent-mini/issues/71) Host `@server:uri` + resolve API | 1.1–1.3 | — |
| [#72](https://github.com/jimchou-h/react-agent-mini/issues/72) REPL wire + slash tests | 2.1–2.2 | #71 |
| [#73](https://github.com/jimchou-h/react-agent-mini/issues/73) Tour prompt, docs, smoke | 3.1–3.3, 4.1–4.2 | #72 |

## 1. Host：解析与按需读取

- [x] 1.1 在 `services/mcp/fetch.ts` 实现 `extractMcpResourceMentions`（`@server:uri`，首个 `:` 拆分）+ 单测
- [x] 1.2 实现 `loadReferencedResourcesAsMetaMessages`（去重、精确 read、失败 warn 跳过、截断）+ 单测
- [x] 1.3 实现 `resolvePromptResourceMessages`：有引用 → 按需；无引用 → fallback `loadServerResourcesAsMetaMessages`；有引用时不做全量补齐 + 单测

## 2. REPL 编排

- [x] 2.1 `repl.ts`：先 `prompts/get`，再 `resolvePromptResourceMessages`，再 `injectBefore: [...resources, ...promptMessages]`
- [x] 2.2 更新 slash 单测：含 `@tour:docs://handbook` 时只挂载该资源；无 `@` 时仍全量挂载

## 3. Demo 与文档

- [x] 3.1 更新 `examples/mcp-tour-server/server.js` 的 `plan_trip` 文案为显式 `@tour:docs://handbook`
- [x] 3.2 核对 `.mcp.json` / README / how-to-host 说明：demo key 建议为 `tour`；必要时同步示例配置
- [x] 3.3 更新 MCP 相关 CONTEXT 或架构说明中「slash 前全量挂载」描述

## 4. 验收

- [x] 4.1 `bun test` + `bun run typecheck` 通过
- [x] 4.2 手动或 smoke：`/tour:plan_trip …` 可见按引用挂载手册，且不依赖项目内同名文件
