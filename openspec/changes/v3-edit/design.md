## Context

claude-code `FileEditTool` 做精确字符串替换。mini 实现最小 API，权限与 Write 共用非只读通道。

## Goals / Non-Goals

**Goals:**

- `Edit(path, old_string, new_string, replace_all?)`
- cwd 校验；文件必须已存在
- 默认：`old_string` 在文件中恰好出现一次才替换
- `replace_all: true` 时替换所有出现
- `old_string === new_string` → 错误
- 走 `canUseTool`；REPL 确认摘要含 path

**Non-Goals:**

- 模糊匹配、正则替换、创建新文件（创建用 Write）
- 二进制文件

## Decisions

### 1. 与 Write 分工

| 场景 | 工具 |
|------|------|
| 新建 / 整文件重写 | Write |
| 改已知片段 | Edit |

### 2. 唯一性

**选择**：默认必须唯一匹配；多处匹配时返回错误，提示改用 `replace_all` 或扩大上下文。

### 3. 大小

读入后仍受 Read 同类限制：文件 ≤100KB 才允许 Edit（与 Write 对称）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| old_string 太短误匹配 | 要求唯一；文档建议多行上下文 |
| CRLF vs LF | 规范化或原样匹配并在错误中提示 |

## Migration Plan

仅新增工具，无破坏。

## Open Questions

- （已关闭）默认唯一匹配
