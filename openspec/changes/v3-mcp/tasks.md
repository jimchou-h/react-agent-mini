## 1. 依赖与配置

- [x] 1.1 添加 `@modelcontextprotocol/sdk` 依赖
- [x] 1.2 实现 `.mcp.json` 加载与类型（`src/services/mcp/config.ts`）
- [x] 1.3 单元测试：无文件 / 非法 JSON / 合法配置

## 2. Client 与适配

- [x] 2.1 实现 stdio 连接与 `listTools`（`client.ts`）
- [x] 2.2 实现 MCP tool → `Tool` 适配（命名前缀、call 转发、错误映射）
- [x] 2.3 连接失败时警告并降级；退出时 close

## 3. CLI 接线

- [x] 3.1 启动时连接 MCP，合并 tools 传入 QueryEngine / headless
- [x] 3.2 `isReadOnly` / `canUseTool` 行为符合 design
- [x] 3.3 README + architecture：配置示例与限制

## 4. 验收

- [x] 4.1 `bun run typecheck` 与 `bun test` 通过
- [x] 4.2 Smoke：fixture 或 mock MCP server 工具可被调用（可用注入 fake transport）
- [x] 4.3 无 `.mcp.json` 时回归与 v2 一致
