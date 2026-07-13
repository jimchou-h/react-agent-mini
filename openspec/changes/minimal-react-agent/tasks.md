## 1. 项目脚手架

- [x] 1.1 初始化 `package.json`（Bun workspaces 不需要，单包即可）、`tsconfig.json`（strict）、`.gitignore`
- [x] 1.2 添加依赖：`openai`、`zod`；dev 依赖：`@types/bun`、`typescript`（#1 仅 zod；openai 见 #2）
- [x] 1.3 配置脚本：`dev`（运行 cli）、`typecheck`（`tsc --noEmit`）、`test`
- [x] 1.4 创建 `src/` 目录骨架（见 design.md 目录结构）

## 2. 类型与消息工具

- [x] 2.1 实现 `src/types/message.ts`：`UserMessage`、`AssistantMessage`、`StreamEvent` 等精简类型
- [x] 2.2 实现 `src/utils/messages.ts`：`createUserMessage`、工具结果消息构造、API 规范化辅助函数
- [x] 2.3 实现 `src/query/types.ts`：`QueryParams`、`Terminal`、`State`

## 3. Tool 系统

- [x] 3.1 实现 `src/Tool.ts`：`Tool` 类型、`ToolUseContext`（精简）、`findToolByName`、`Tools` 类型
- [x] 3.2 实现 `src/tools/EchoTool.ts`（Zod schema + call）
- [x] 3.3 实现 `src/tools/ReadTool.ts`（路径校验、100KB 限制、UTF-8 读取）
- [x] 3.4 实现 `src/tools/index.ts` 工具注册表 `getTools()`
- [x] 3.5 实现 `src/services/tools/execution.ts`：单工具 `runToolUse`（含 input 校验、auto-allow 权限）
- [x] 3.6 实现 `src/services/tools/orchestration.ts`：串行 `runTools`

## 4. DeepSeek Provider 适配层

- [x] 4.1 实现 `src/services/api/openai/adapter.ts`：内部 Message ↔ OpenAI messages/tools 双向转换
- [x] 4.2 实现 `src/services/api/openai/stream.ts`：流式解析 text delta 与 tool_calls 分片组装
- [x] 4.3 实现 `src/services/api/client.ts`：`callModel` async generator 入口，读取环境变量
- [x] 4.4 实现 `src/query/deps.ts`：`QueryDeps`、`productionDeps()`（含 `QUERY_MOCK` + `services/api/mock.ts`）

## 5. ReAct 核心循环

- [x] 5.1 实现 `src/query.ts`：`query()` / `queryLoop()`，`while(true)` + `needsFollowUp` 终止逻辑
- [x] 5.2 接入 `deps.callModel` 流式 yield 与 `runTools` 工具执行
- [x] 5.3 实现 `maxTurns` 限制与 `{ reason: 'completed' | 'max_turns' }` 返回
- [x] 5.4 为核心循环文件添加中文注释（说明每阶段职责）

## 6. CLI 入口

- [x] 6.1 实现 `src/entrypoints/cli.ts`：参数模式 + pipe 模式（`-p`，#4 完善体验）
- [x] 6.2 启动时检查 `OPENAI_API_KEY`，缺失时中文错误 + exit 1（`QUERY_MOCK=1` 豁免）
- [x] 6.3 消费 `query()` 生成器：流式打印 text delta、工具状态中文提示

## 7. 文档

- [ ] 7.1 编写 `docs/architecture.md`（中文）：ReAct 流程图、模块职责、扩展路线图
- [ ] 7.2 创建 `CONTEXT-MAP.md` 及 `src/query/CONTEXT.md`、`src/tools/CONTEXT.md`、`src/services/api/CONTEXT.md`（术语表）
- [ ] 7.3 更新 `README.md`：安装、环境变量、运行示例

## 8. 验收（Smoke Test）

- [x] 8.1 `bun run typecheck` 零错误
- [x] 8.2 `QUERY_MOCK=1 bun run dev -- "用 Echo 回复 hello"` 成功返回（#1）
- [x] 8.3 `bun run dev -- "读取 README.md 并一句话总结"` 成功调用 Read 并回答（集成测试覆盖；真实 DeepSeek 需人工 smoke）
- [x] 8.4 确认多轮 tool call 场景可完成（如先 Read 再总结）
