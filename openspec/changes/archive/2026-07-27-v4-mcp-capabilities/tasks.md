## 1. Client 能力协商

- [x] 1.1 `connectOneServer` 读取 `getServerCapabilities()`；session 保存 connected clients
- [x] 1.2 `fetchResourcesForClient` / `fetchCommandsForClient`（fail-soft `[]`）+ 单测
- [x] 1.3 无 resources/prompts capability 时跳过，tools 路径不变

## 2. Resources 工具（对齐 CC）

- [x] 2.1 实现 `ListMcpResourcesTool`（可选 `server` 过滤）+ 单测
- [x] 2.2 实现 `ReadMcpResourceTool`（`server` + `uri`；text/blob 策略；100k 截断）+ 单测
- [x] 2.3 任一 server 有 resources 时动态注入两工具（全局去重一次）

## 3. Prompts slash（对齐 CC）

- [x] 3.1 `prompts/get` 封装 + args zip 对齐 `prompt.arguments`
- [x] 3.2 REPL：合并 MCP slash 命令；解析 `server:prompt (MCP) args`；meta 消息注入当前 turn
- [x] 3.3 测试：list 命令、执行 prompt、未知命令；**不**经 SkillTool 暴露

## 4. 文档与验收

- [x] 4.1 更新 MCP CONTEXT / README / repl 帮助（含 MCP slash 格式）
- [x] 4.2 扩展 tour server 或 smoke：list → read resource → slash prompt → tool
- [x] 4.3 typecheck + test 通过
