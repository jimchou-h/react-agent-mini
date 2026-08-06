# Claude Code 对齐规则

本仓库后续开发默认遵循“**对齐 claude-code 的语义与边界，不机械复制其体积与颗粒度**”。

## 总原则

- 对齐概念名、调用顺序、模块边界，不为了“看起来像”提前过度拆分。
- 新功能优先落到现有 seam：`query`、`QueryEngine`、`Tool`、`tools`、`services/mcp`、`services/tools`、`entrypoints`。
- 先做最小可运行实现；文件明显变厚、职责冲突时再拆分。

## 目录落位

- `entrypoints/*`：CLI / REPL 启动、参数解析、输入输出路由，不放深业务。
- `query/*`：单轮主循环、终止条件、deps、types、出站消息拼装。
- `QueryEngine.ts`：多轮会话状态与 `runTurn()`；不承载工具或 MCP 细节。
- `Tool.ts`：工具契约、`ToolUseContext`、权限回调类型。
- `tools/*`：单工具实现与注册，不直接承担会话编排。
- `services/*`：跨入口的子系统，如 API、MCP、compact、工具执行流水线。
- `utils/*`：纯辅助函数；若模块依赖会话或外部系统，应提升到对应子域。

## 新功能开发规则

- 新工具：先放 `tools/*`，再在 `tools/index.ts` 或 `sessionTools()` 注册。
- 工具执行策略、并发、权限后续动作：放 `services/tools/*`。
- 模型 Provider / 适配层：放 `services/api/*`。
- MCP 能力扩展：优先继续集中在 `services/mcp/*`。
- 权限规则：统一从 `canUseTool` 一类入口进入，不让各工具私自实现一套。
- 上下文裁剪、budget、compact：统一放在 `query` 出站阶段或 `services/compact/*`。

## 与 claude-code 对齐时的取舍

- 优先对齐：
  - 命名
  - 责任边界
  - 调用顺序
  - **prompt / 协议原文**（先读 CC 源码再动手；默认照搬，禁止先写「自创精简版」）
  - 可测试 seam
  - fail-soft / fail-closed 的放置位置
- 暂不硬对齐：
  - 大仓库级目录颗粒度
  - 为未来能力预埋的大量抽象
  - 多产品、多人协作、历史兼容层
  - Non-Goals 已写明砍掉的平台能力（Ink、AskUserQuestion 等）

详见 `.cursor/rules/align-claude-code.mdc`。
## 演进阈值

- 单文件开始同时承担类型、业务、格式化、IO、错误策略时，应考虑拆分。
- 文件超过约 200-300 行且出现多个职责块时，优先按职责拆，而不是平均拆函数。
- 测试为了 mock 一个大文件变得很痛苦时，通常说明 seam 不够清晰。

## 注释与测试

- 每个生产文件保留文件头，说明“负责什么 / 不负责什么”。
- 非显然顺序或约束写 why 注释，尤其是消息顺序、tool_result 配对、权限拒绝、MCP 注入顺序。
- 新功能优先补边界测试：注册、路由、失败路径、预算、权限中止。

## 一句话约束

按 `claude-code` 的**架构方向**长，不按它的**仓库体积**长。

**对齐纪律**：claude-code 没有的能力，默认不加；若确需偏离（mini 特例），必须先在对话中明确告知用户并得到确认，再写进 change 的 Non-Goals / Risks。
