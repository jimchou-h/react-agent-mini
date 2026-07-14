## 1. Grep 工具

- [x] 1.1 实现 `src/tools/GrepTool.ts`（pattern、path、glob、head_limit）
- [x] 1.2 路径校验复用 `resolvePathUnderCwd` 模式
- [x] 1.3 单元测试：匹配、越界、head_limit 截断

## 2. Glob 工具

- [x] 2.1 实现 `src/tools/GlobTool.ts`（pattern、path、100 条上限）
- [x] 2.2 单元测试：匹配、越界、截断

## 3. Read 增强

- [x] 3.1 `ReadTool` 增加 `offset`/`limit` Zod 字段与行号输出
- [x] 3.2 更新 Read 单元测试；无 offset 时行为与 v0 一致

## 4. 注册与适配

- [x] 4.1 `getTools()` 注册 Grep、Glob
- [x] 4.2 `adapter.ts` tools 出站包含新工具；`cliHelpers` 状态行

## 5. 验收

- [x] 5.1 `bun run typecheck` 零错误
- [x] 5.2 `bun test` 全通过
- [x] 5.3 集成测试或 smoke：`Grep` 找符号 + `Read` 读文件（mock 或真实 API）
