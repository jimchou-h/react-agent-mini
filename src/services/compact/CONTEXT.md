# compact 模块术语表

出站消息裁剪与 LLM 摘要（Context Budget）。源码：`src/services/compact/`。

## 核心术语

| 术语 | 说明 |
|------|------|
| **compactMessages** | 纯函数：出站副本裁剪；无变更时返回原数组 |
| **出站-only** | 确定性层只裁发给模型的副本，默认不写回 `QueryEngine.messages` |
| **microcompact** | 默认 **no-op**（对齐 CC legacy content-clear 已移除）；`COMPACT_MICRO_CONTENT_CLEAR=1` 可恢复旧占位 |
| **autocompact** | 超阈值时侧路 LLM 摘要，**写回**会话（boundary + summary + 尾部） |
| **compact boundary** | meta 用户消息 `[compact boundary]`，之后为活历史 |
| **`/compact`** | REPL 手动触发与 autocompact 相同的写回路径；实质压缩时打印 before→after |
| **`/status`** | REPL 查看当前 ctx 占用（与回合后 `ctx ~NN%` 同源） |
| **formatCompactSuccessFeedback** | `/compact` 与 autocompact 共用成功文案；占用未变返回 null |
| **ctx %** | `estimateContextUsage`：优先 API usage，否则字符≈token |
| **maxToolResultChars** | 单条 `tool_result` 字符上限（默认 4000） |
| **maxMessages** | 出站条数上限（默认 40），超出丢最早轮次保尾 |
| **COMPACT=0** | 关闭整条 compact（确定性 + 自动 LLM） |
| **AUTOCOMPACT=0** | 只关自动 LLM；`/compact` 仍可用 |
| **CONTEXT_WINDOW_TOKENS** | 占用 % 分母（默认 128000） |
| **AUTOCOMPACT_PERCENT** | 自动摘要占用阈值（默认 80） |

## 触发与关闭

1. 出站裁剪：每轮 callModel 前（受 `COMPACT`）
2. autocompact：占用 ≥ `AUTOCOMPACT_PERCENT` 时侧路摘要写回（受 `COMPACT` + `AUTOCOMPACT`）
3. 手动：`/compact`（仅受 `COMPACT=0` 时整条关闭的影响；`AUTOCOMPACT=0` 仍可用）
4. 查看占用：回合后 `ctx ~NN%` 或 `/status`

## 限制

- 字符近似为主；有 usage 时优先 token
- 无 reactive compact / session memory compact
- 连续 autocompact 失败会熔断（默认 3 次）
