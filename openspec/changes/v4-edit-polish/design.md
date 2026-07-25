## Context

Edit 字面 `indexOf` 在 CRLF 仓库上易失败。claude-code 用 `findActualString`；mini 做可测子集。

## Goals / Non-Goals

**Goals:**

- 读入后统一 `\r\n` → `\n` 再匹配与写回策略明确（写回 LF，或写回时恢复原换行——选一种并测）
- `findActualString` 精简：精确命中优先；否则尝试去行尾空白后再唯一匹配
- 错误信息提示换行/空白

**Non-Goals:**

- 正则、模糊编辑距离
- 空 old_string 创建文件（本 change 不做）

## Decisions

### 1. 换行

**选择**：匹配用 LF 视图；写回时若原文件含 CRLF 则写回 CRLF，否则 LF（检测原文件）。

### 2. 空白

**选择**：仅当精确匹配失败且去行尾空白后恰好一处命中时采用；多处仍报错。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 误匹配 | 仍要求唯一 |
| 换行风格被改 | 写回恢复检测 |

## Migration Plan

行为对纯 LF 文件与现网一致；CRLF 仓库体验改善。

## Open Questions

- （已关闭）不建文件
