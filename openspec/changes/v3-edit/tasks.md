## 1. Edit 工具

- [x] 1.1 实现 `src/tools/EditTool.ts`（唯一匹配、replace_all、cwd/大小校验）
- [x] 1.2 单元测试：成功、多次匹配、未找到、越界、replace_all
- [x] 1.3 注册 `getTools()`；`cliHelpers` 状态行与权限摘要

## 2. 权限与文档

- [x] 2.1 确认 REPL/headless 对 Edit 与 Write 一致
- [x] 2.2 更新 architecture / tools CONTEXT / README（Edit vs Write）

## 3. 验收

- [x] 3.1 `bun run typecheck` 与 `bun test` 通过
- [x] 3.2 Smoke：允许后局部替换成功；拒绝后文件不变
