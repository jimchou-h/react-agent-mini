## Context

Edit 字面 `indexOf` 在 CRLF 仓库上易失败。claude-code 当前读文件时统一 LF 视图并恢复原换行风格；mini 对齐这部分现状，不额外引入尾随空白回退。

## Goals / Non-Goals

**Goals:**

- 读入后统一 `\r\n` → `\n` 再匹配，并写回恢复原换行风格
- 继续保持精确匹配语义，不额外引入尾随空白回退
- 错误信息提示换行风格

**Non-Goals:**

- 正则、模糊编辑距离
- 空 old_string 创建文件（本 change 不做）

## Decisions

### 1. 换行

**选择**：匹配用 LF 视图；写回时若原文件含 CRLF 则写回 CRLF，否则 LF（检测原文件）。

### 2. 匹配语义

**选择**：保持当前精确匹配语义；本 change 只解决 CRLF/LF 视图差异，不做尾随空白容错。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 误匹配 | 仍要求唯一 |
| 换行风格被改 | 写回恢复检测 |

## Migration Plan

行为对纯 LF 文件与现网一致；CRLF 仓库体验改善。

## Open Questions

- （已关闭）不建文件
