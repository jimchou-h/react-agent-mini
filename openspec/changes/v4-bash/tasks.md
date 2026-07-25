## 1. Bash 工具核心

- [ ] 1.1 实现 `BashTool`（cwd 执行、超时、输出截断、非零退出码）
- [ ] 1.2 单元测试：成功、非零退出、超时、截断、`isReadOnly=false`

## 2. 注册与权限

- [ ] 2.1 注册 `getTools()`；CLI 状态行；权限确认摘要含命令预览
- [ ] 2.2 Smoke：REPL deny 不执行；headless 无 `ALLOW_WRITE` deny；allow 后可跑无害命令

## 3. 文档与验收

- [ ] 3.1 更新 README / architecture / tools CONTEXT（风险说明 + blog 钩子材料）
- [ ] 3.2 `bun run typecheck` 与 `bun test` 通过
