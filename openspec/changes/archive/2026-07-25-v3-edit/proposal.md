## Why

`Write` 整文件覆盖对局部改代码过粗、易误伤。对齐 claude-code `FileEditTool` 的精简版：按 `old_string`/`new_string` 替换，配合现有写权限，使 Agent 更像可用的 coding agent。

## What Changes

- 新增 `Edit` 工具：`path`、`old_string`、`new_string`、可选 `replace_all`
- 路径校验复用 `resolvePathUnderCwd`；`isReadOnly` → false，走 `canUseTool`
- 唯一匹配才替换（默认）；`replace_all` 时替换全部
- 注册 `getTools()`；CLI 状态行；单测与 smoke
- 文档：Edit vs Write 选用建议

## Capabilities

### New Capabilities

- `edit-tool`：基于字符串替换的文件局部编辑

### Modified Capabilities

- `tool-system`：注册 Edit；写权限策略覆盖 Edit（与 Write 相同）
- `permission-pipeline`：非只读确认文案支持 Edit 摘要

## Impact

- **新增**：`src/tools/EditTool.ts`
- **修改**：`getTools()`、`cliHelpers`、`canUseTool` 摘要格式化
- **非目标**：diff UI、patch 格式、IDE apply
