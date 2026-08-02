## Why

长会话与跨会话偏好目前只能靠 `AGENTS.md` / Skills 静态注入；claude-code 有 session memory 与 memory 预取。在 hooks 与 compact 之后，需要一层**可写、可注入**的轻量记忆，避免一上来做完整 CC session memory compact 全家桶。

## What Changes

- **项目记忆文件**：约定路径（如 `MEMORY.md` 或 `.agents/memory/MEMORY.md`），启动时加载进 system / 附件上下文
- **会话内更新**：模型经只读/受控工具或 slash（如 `/memory`）查看；写入走权限闸（REPL 确认 / headless `ALLOW_WRITE`）
- **预取**：每轮 query 前若文件变更或首次，将摘要/正文按预算注入（对齐 CC attachments/memory prefetch 的精简版）
- **与 compact 边界**：memory 不替代 autocompact；不在本 change 做 session memory compact

**非目标**：

- 完整 CC session memory + forkedAgent 摘要管线
- 云端 `/memory-stores`、多 store vault
- 子代理共享 memory 缓存清理语义

## Capabilities

### New Capabilities

- `agent-memory`: 持久记忆文件的加载、预算内注入与受控更新

### Modified Capabilities

- `project-context`: 启动上下文可与 memory 并存（顺序与预算需约定）
- `query-engine` / `react-loop`: 轮次前 memory 预取（若行为写入规格）
- `repl-session`: 可选 `/memory` 查看/提示

## Impact

- **新增**：memory 加载与注入模块；可选 Memory 工具或 slash
- **修改**：CLI/REPL 启动与 query 预取路径
- **版本**：v6 三件套之一（与 `v6-subagents`、`v6-stop-hooks` 并行；建议实现顺序 Memory → Stop → Subagents）
- **依赖**：v5（autocompact / hooks Pre·Post / skill slash）已完成
