## 1. Hook 运行时

- [ ] 1.1 定义 hook 配置类型与加载器（文件缺失 / `HOOKS=0`）+ 单测
- [ ] 1.2 实现 PreToolUse / PostToolUse runner（matcher、超时、deny）+ 单测

## 2. 工具路径接线

- [ ] 2.1 在工具执行路径插入 Pre/Post；deny 不 call + 单测
- [ ] 2.2 TRACE 或 stderr 摘要可观测 hook 命中

## 3. 文档与验收

- [ ] 3.1 README / CONTEXT：配置示例、安全说明、`HOOKS=0`
- [ ] 3.2 可选：Stop hook 最小实现（或明确推迟并从 Non-Goals 勾掉）
- [ ] 3.3 `bun test` + typecheck；示例 hook 拦 Bash 或记日志可演示
