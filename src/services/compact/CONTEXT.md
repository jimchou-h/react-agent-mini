# compact 模块术语表

出站消息裁剪（Context Budget）。源码：`src/services/compact/`。

## 核心术语

| 术语 | 说明 |
|------|------|
| **compactMessages** | 纯函数：出站副本裁剪；无变更时返回原数组 |
| **出站-only** | 只裁发送给模型的副本，`QueryEngine.messages` 不变 |
| **maxToolResultChars** | 单条 `tool_result` 字符上限（默认 4000），超出截断并附提示 |
| **maxMessages** | 出站条数上限（默认 40），超出丢最早轮次保尾 |
| **裁剪边界** | 对齐 user 纯文本消息，不裁断 `tool_use`/`tool_result` 配对 |
| **COMPACT=0** | 环境变量关闭开关 |
| **compact.run** | `TRACE=1` 且实质裁剪时的埋点（before/after/dropped/truncated） |

## 限制（v3）

- 确定性裁剪；不做 LLM 摘要（autocompact）与 microcompact
- 字符近似，不做精确 token 计数
- 无写回模式；长会话内存仍增长（可 `/clear`）
