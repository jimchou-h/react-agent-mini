## 1. 加载模块

- [x] 1.1 实现 `src/utils/projectContext.ts`：发现 AGENTS.md / CLAUDE.md、合并、64KB 截断
- [x] 1.2 单元测试：有/无文件、合并、截断、向上查找

## 2. Provider 与 query

- [x] 2.1 `CallModelParams` / `QueryParams` 增加可选 `systemPrompt`
- [x] 2.2 `adapter` / `callModel` 注入 system 消息；单测覆盖
- [x] 2.3 `query.ts` 透传 `systemPrompt` 到 `callModel`

## 3. CLI 接线

- [x] 3.1 `QueryEngine` 构造支持 `systemPrompt`
- [x] 3.2 `cli.ts` / `repl.ts` 启动时 `loadProjectContext()` 并传入
- [x] 3.3 headless / pipe 同样注入

## 4. 文档与验收

- [ ] 4.1 更新 `docs/architecture.md`、相关 CONTEXT.md、README
- [ ] 4.2 `bun run typecheck` 与 `bun test` 通过
- [ ] 4.3 人工 smoke：目录有 AGENTS.md 时 TRACE/行为可见 system 生效（或单测等价）
