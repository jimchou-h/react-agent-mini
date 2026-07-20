## 1. 权限管道

- [x] 1.1 扩展 `ToolUseContext`：可选 `canUseTool`
- [x] 1.2 `runToolUse` 使用注入回调；单测 deny / allow
- [ ] 1.3 实现 `createReplCanUseTool(ask)` 与 `createHeadlessCanUseTool()`（含 `ALLOW_WRITE`）

## 2. Write 工具

- [ ] 2.1 实现 `WriteTool.ts`（路径校验、100KB、覆盖写）
- [ ] 2.2 注册 `getTools()`；cliHelpers 状态行
- [ ] 2.3 单元测试：成功、越界、过大

## 3. CLI / REPL 接线

- [ ] 3.1 REPL 注入交互式 `canUseTool`
- [ ] 3.2 headless/pipe 注入 headless 策略
- [ ] 3.3 文档说明 `ALLOW_WRITE=1`

## 4. 验收

- [ ] 4.1 更新 architecture / CONTEXT / README
- [ ] 4.2 `bun run typecheck` 与 `bun test` 通过
- [ ] 4.3 Smoke：REPL 拒绝则文件不变；确认后写入成功
