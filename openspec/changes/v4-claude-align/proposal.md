## Why

react-agent-mini 已有工具、权限、Skills、MCP、compact 等能力，但与 claude-code 在**对外契约**（schema 字段名、默认行为、拒绝文案、Skill ID、Grep 默认输出等）上存在多处漂移。同一提示词在 Claude Code 能跑通，在本仓库可能因 `path` vs `file_path`、`timeout_ms` vs `timeout` 等直接失败。目标不是补齐全部功能，而是让**已有能力的行为与 claude-code 对齐**。

## What Changes

- **BREAKING**：Read / Write / Edit 入参 `path` → `file_path`（同步权限摘要、compact path 线索）
- **BREAKING**：Bash 入参 `timeout_ms` → `timeout`（可短期保留别名兼容）
- Grep：默认 `output_mode: files_with_matches`；默认 `head_limit` 250；支持 `output_mode` 三模式（content / files_with_matches / count）
- Read：整文件也带行号（`N→` 或 `N\t` 形态）；`offset` 允许 0（视为第 1 行）
- Write：父目录不存在时 `mkdir` 后再写；成功文案对齐 claude-code 风格
- Edit：吸收 `v4-edit-polish`（CRLF 规范化、去行尾空白唯一回退）；`file_path` 字段
- Bash：默认超时 120s（对齐 claude-code）；权限摘要读 `timeout`
- Skill：调用 ID = **目录名**（frontmatter `name` 仅展示）；可选 `args`；注入方式向 meta + 短 tool_result 靠拢
- 权限：用户拒绝文案对齐英文 `REJECT_MESSAGE` 语义
- MCP：公开工具名经 `normalizeNameForMCP`（`.` / 空格 → `_`）
- compact：仅对 COMPACTABLE 工具类 `tool_result` 做 microcompact；占位文案与 path 线索对齐 `file_path`

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `tool-system`：Read 字段 `file_path`、行号输出、`offset` 语义
- `write-tool`：`file_path`、自动 `mkdir`、成功文案
- `edit-tool`：`file_path`、CRLF/空白匹配（合并原 `v4-edit-polish`）
- `bash-tool`：`timeout` 字段、默认 120s
- `grep-tool`：默认 `files_with_matches`、`head_limit` 250、`output_mode`
- `skill-system`：目录名 ID、可选 `args`、注入通道
- `permission-pipeline`：拒绝文案对齐 `REJECT_MESSAGE`
- `mcp-client`：工具名 normalize
- `context-compact`：COMPACTABLE 集合、占位与 `file_path` 线索

## Impact

- **修改**：`ReadTool` / `WriteTool` / `EditTool` / `BashTool` / `GrepTool` / `SkillTool`、`discover.ts`、`canUseTool.ts`、`services/mcp/adapter.ts`、`services/compact/compact.ts`、相关测试与 CONTEXT
- **文档**：README / architecture 中 schema 示例与默认值
- **非目标**：Ink 权限 UI、Bash 沙箱/后台、LLM autocompact、并发分区、SSE MCP、完整 CLAUDE.md 树、`~/.claude/skills` 扫描、readFileState 陈旧检查
- **关系**：本 change **吸收并取代** 进行中的 `v4-edit-polish`（CRLF 任务并入此处）；不与 `v4-mcp-capabilities`（Resources/Prompts）重叠

## Blog 角度

| 要素 | 内容 |
|------|------|
| 定位 | 附录/短帖：「为什么 mini 要和 Claude Code 用同一套 tool schema」 |
| 钩子 | 同一行 `file_path` 在 Claude 能写、在 mini 报 Zod 错 |
| 演示 | 改字段前后对比；Grep 默认从「行」变「文件列表」 |
| 刻意不做 | 不写成完整功能 parity 清单 |
