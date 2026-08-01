## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#77](https://github.com/jimchou-h/react-agent-mini/issues/77) Config load + PreToolUse deny | 1.1–1.2, 2.1（Pre） | — |
| [#78](https://github.com/jimchou-h/react-agent-mini/issues/78) PostToolUse + TRACE | 2.1（Post）, 2.2 | #77 |
| [#79](https://github.com/jimchou-h/react-agent-mini/issues/79) Docs, example, defer Stop | 3.1–3.3 | #78 |

## 1. Hook 运行时

- [x] 1.1 定义 hook 配置类型与加载器（文件缺失 / `HOOKS=0`）+ 单测
- [x] 1.2 实现 PreToolUse / PostToolUse runner（matcher、超时、deny）+ 单测

## 2. 工具路径接线

- [x] 2.1 在工具执行路径插入 Pre/Post；deny 不 call + 单测
- [x] 2.2 TRACE 或 stderr 摘要可观测 hook 命中

## 3. 文档与验收

- [x] 3.1 README / CONTEXT：配置示例、安全说明、`HOOKS=0`
- [x] 3.2 **推迟**：Stop hook 不进本 change（写入 Non-Goals / 文档说明）
- [x] 3.3 `bun test` + typecheck；示例 hook 拦 Bash 或记日志可演示
