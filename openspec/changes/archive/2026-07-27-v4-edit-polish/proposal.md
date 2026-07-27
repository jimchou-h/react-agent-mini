## Why

Edit 已能唯一匹配替换，但 Windows CRLF 常导致「肉眼一样、字面找不到」。收敛到与当前 claude-code 一致的最小子集：统一 LF 视图匹配、写回恢复原换行风格，减少假失败，适合作为 Edit blog 的补章或附录升级，不必单独占一条大版本叙事。

## What Changes

- 匹配前规范化：CRLF→LF；写回恢复原文件换行风格
- 未找到时错误信息提示「可检查换行风格」
- 单测：CRLF 文件、`old_string` 用 LF 仍能命中
- 文档一小段；不改变默认唯一匹配 / `replace_all` 语义

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `edit-tool`：匹配策略增强（CRLF 规范化 / 写回恢复原换行）

## Impact

- **修改**：`EditTool.ts`、Edit 测试、tools CONTEXT
- **非目标**：尾随空白回退匹配、模糊匹配、正则、空 `old_string` 建文件（若做另开 task，默认本 change 仍不包含建文件）
- **Blog**：不宜独立成篇；材料并入 Edit/Write 对比文附录

## Blog 角度

| 要素 | 内容 |
|------|------|
| 定位 | **补章/附录**，不单独发 CSDN 长文 |
| 钩子 | 「明明看着一样，为什么 Edit 说找不到？」 |
| 刻意不做 | 不写成安全或 diff 专论 |
