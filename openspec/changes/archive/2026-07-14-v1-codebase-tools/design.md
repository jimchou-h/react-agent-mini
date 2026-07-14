## Context

claude-code 的 Grep/Glob 依赖 ripgrep 与复杂权限；v1 裁剪为 **cwd 内只读 + 结果上限**，对齐 react-agent-mini 学习定位。

## Goals / Non-Goals

**Goals:**

- Grep：支持 `pattern`、可选 `path`（cwd 子树）、`glob` 过滤、`head_limit`（默认 50）
- Glob：支持 `pattern`、可选 `path`，结果上限 100 条
- Read：`offset`（1-based 行号）、`limit`（行数），与 claude-code 语义接近
- 全部 `isReadOnly: true`，v0 auto-allow 继续适用

**Non-Goals:**

- ripgrep 全参数集（-A/-B/-C、output_mode 等）— 后续按需加
- 并发只读工具分区
- `.gitignore` 尊重（v1 可不做，文档注明）

## Decisions

### 1. Grep 实现策略

**选择**：优先 `Bun.$` 调用系统 `rg`（若 PATH 存在）；否则用 `node:fs` 遍历 + `RegExp` 匹配（慢但可测）。

**理由**：Windows 开发机常见无 rg；测试用 JS 回退不依赖外部二进制。

**备选**：捆绑 vendor ripgrep — 过重，留 claude-code 对齐时再考虑。

### 2. Glob 实现

**选择**：Bun 内置 `Glob` API（`import { Glob } from 'bun'`）或 Node `fs` + minimatch — 以 Bun 原生优先。

**理由**：无新依赖；结果限 100 路径。

### 3. Read offset/limit

**选择**：读入文件后按行 split，返回 `[offset, offset+limit)` 行，附行号前缀 `LINE|content`。

**理由**：与 claude-code 输出形态接近；仍受 100KB 文件大小上限约束。

### 4. 结果大小

**选择**：Grep 输出字符上限 32KB；Glob 最多 100 文件路径。

**理由**：防止 tool_result 撑爆 context。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 无 rg 时大仓库 Grep 慢 | 文档说明；`head_limit` 默认 50 |
| 正则 ReDoS | 限制 pattern 长度；超时留后续 |
| Read offset 仍受 100KB 限制 | 大文件先 Glob 再分段 Read |

## Migration Plan

向后兼容：Read 无 offset/limit 时行为与 v0 一致。Echo 保留。

## Open Questions

- （已关闭）Grep 默认 head_limit → 50
