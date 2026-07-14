## 1. QueryEngine

- [x] 1.1 实现 `src/QueryEngine.ts`：`messages`、`runTurn()`、`clear()`
- [x] 1.2 单元测试：两轮对话 messages 累积、`clear` 重置、`maxTurns` 透传

## 2. 输出复用

- [x] 2.1 从 `cli.ts` 抽出 `consumeQueryStream()`（流式 stdout/stderr）
- [x] 2.2 headless 模式改用 `consumeQueryStream`，行为与 v0 一致

## 3. REPL

- [x] 3.1 实现 `src/entrypoints/repl.ts`：readline 循环 + `QueryEngine`
- [x] 3.2 实现 slash 命令：`/exit`、`/clear`、`/help`
- [x] 3.3 `cli.ts` 路由：无参数 → REPL；有参数 / `-p` → headless

## 4. 脚本与文档

- [ ] 4.1 更新 `package.json`（可选 `dev:repl` 别名）与 `README.md` REPL 用法
- [ ] 4.2 更新 `docs/architecture.md` L1 会话层、`src/query/CONTEXT.md` QueryEngine 术语

## 5. 验收

- [ ] 5.1 `bun run typecheck` 零错误
- [ ] 5.2 `bun test` 全通过（含 QueryEngine 测试）
- [ ] 5.3 人工 smoke：REPL 连续 3 轮对话上下文不丢；headless / pipe 仍可用
