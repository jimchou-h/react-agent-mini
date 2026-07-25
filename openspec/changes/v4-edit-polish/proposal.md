## Why

Edit 已能唯一匹配替换，但 Windows CRLF、尾随空白常导致「肉眼一样、字面找不到」。对齐 claude-code `findActualString` 的精简版，减少假失败，适合作为 Edit blog 的补章或附录升级，不必单独占一条大版本叙事。

## What Changes

- 匹配前可选规范化：CRLF→LF；查找时容忍行尾空白差异（精简 `findActualString`）
- 未找到时错误信息提示「可检查换行/空白」或展示近似建议（可选，保持短）
- 单测：CRLF 文件、`old_string` 用 LF 仍能命中
- 文档一小段；不改变默认唯一匹配 / `replace_all` 语义

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `edit-tool`：匹配策略增强（规范化 / 容错查找）

## Impact

- **修改**：`EditTool.ts`、Edit 测试、tools CONTEXT
- **非目标**：模糊匹配、正则、空 `old_string` 建文件（若做另开 task，默认本 change 仍不包含建文件）
- **Blog**：不宜独立成篇；材料并入 Edit/Write 对比文附录

## Blog 角度

| 要素 | 内容 |
|------|------|
| 定位 | **补章/附录**，不单独发 CSDN 长文 |
| 钩子 | 「明明看着一样，为什么 Edit 说找不到？」 |
| 刻意不做 | 不写成安全或 diff 专论 |
