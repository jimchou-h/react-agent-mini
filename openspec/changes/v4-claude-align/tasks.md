## 1. 文件类工具 schema（file_path）

- [x] 1.1 Read：`path` → `file_path`；整文件带行号；`offset` 允许 0
- [x] 1.2 Write：`file_path` + 自动 `mkdir`；成功文案对齐
- [x] 1.3 Edit：`file_path`；CRLF 规范化 + 去行尾空白唯一回退（吸收 v4-edit-polish）
- [x] 1.4 更新 `canUseTool` 摘要与 compact path 线索读 `file_path`
- [x] 1.5 单测 / smoke：Read / Write / Edit 全量改字段

## 2. Bash 与 Grep 契约

- [x] 2.1 Bash：`timeout` 字段（`timeout_ms` 短期别名）；默认 120s；硬顶 600s
- [x] 2.2 Grep：`output_mode` 三模式；默认 `files_with_matches`；`head_limit` 默认 250
- [x] 2.3 单测：Bash timeout；Grep 默认与 content 模式

## 3. Skill 对齐

- [x] 3.1 `discover.ts`：调用 ID = 目录名；frontmatter `name` → displayName
- [x] 3.2 `Skill` tool：可选 `args`；正文注入通道 + 短 tool_result
- [x] 3.3 单测：目录名与 displayName 不一致场景；未知 skill

## 4. 权限 / MCP / compact

- [x] 4.1 `USER_REJECT_MESSAGE` → 对齐英文 `REJECT_MESSAGE`
- [x] 4.2 MCP `normalizeNameForMCP` 公开名
- [x] 4.3 compact：COMPACTABLE 集合 + 英文占位 + `file_path` 线索
- [x] 4.4 单测：拒绝文案、MCP 名含 `.`、microcompact 跳过 Echo

## 5. 文档与验收

- [x] 5.1 更新 README / architecture / 相关 CONTEXT（schema 示例）
- [x] 5.2 标注 `v4-edit-polish` 已由本 change 吸收
- [x] 5.3 `bun test` + `bun run typecheck` 通过
