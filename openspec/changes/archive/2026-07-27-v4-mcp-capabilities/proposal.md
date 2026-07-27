## Why

v3 MCP 只接了 Tools + stdio。概念 blog 已讲六大能力，但 Host 侧仍缺 Resources / Prompts，读者无法在 Agent 里走一遍。本 change 在 **stdio 子集**内对齐 claude-code 的 Host 形态：Resources 经两个只读内置工具暴露；Prompts 经 REPL slash 命令注入（**不走 Skill 工具、不自动改 systemPrompt**）。

## What Changes

- **MCP Client**：`initialize` 后读取 `getServerCapabilities()`；按能力门控 resources / prompts 路径（缺失 fail-soft，tools 行为与 v3 一致）
- **Resources**：`resources/list` + `resources/read`；动态注入 `ListMcpResourcesTool`、`ReadMcpResourceTool`（任一 connected server 声明 resources 时，全局只注入一次）
- **Prompts**：`prompts/list` + `prompts/get`；转为 REPL slash 命令（用户面 `server:prompt (MCP) args`；内部名 `mcp__<server>__<prompt>`）；执行后以 **meta 消息**注入当前 turn，**不提供**模型可调用的 prompt 工具
- **示例 / smoke**：扩展 `examples/mcp-tour-server`（或等价）；文档链接概念篇

**非目标**（与 claude-code 在该子集上一致或 mini 合理省略）：

- Sampling、Roots、Elicitation、`resources/subscribe`
- SSE/HTTP、OAuth（mini 仍仅 stdio）
- `@server:uri` 资源附件补全、`list_changed` 热更新、LRU prefetch
- MCP skills（`skill://` + SkillTool 合并）
- Prompt 经 Skill 工具或 systemPrompt 自动追加

## Capabilities

### New Capabilities

- `mcp-resources`：资源 list/read + 两个只读内置工具
- `mcp-prompts`：prompt list/get + REPL slash 注入

### Modified Capabilities

- `mcp-client`：能力协商、session 状态、动态注入 resource 工具
- `repl-session`：MCP slash 命令解析与执行

## Impact

- **修改**：`src/services/mcp/`、`src/tools/`（List/Read MCP resource tools）、`src/entrypoints/repl.ts` / slash 解析、文档
- **Blog**：概念篇补章——工具箱 vs 资料架 vs 提词器；演示 tour server：list resource → read → slash prompt → 调 tool

## Blog 角度

| 要素 | 内容 |
|------|------|
| 钩子 | 「Tools 之外，材料（Resources）和开场白（Prompts）怎么进 Agent？」 |
| 对齐 CC | 与 Claude Code 同款两工具 + slash `(MCP)`，便于同一套演示脚本 |
| 演示 | tour server：模型 `ListMcpResourcesTool` → `ReadMcpResourceTool`；用户 `/demo:greet (MCP) world` |
| 刻意不做 | SSE/OAuth、Sampling、`@` 补全、MCP skills |
