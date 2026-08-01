## Context

`runTools` 在 `abortController.signal.aborted` 时 `break`，不再执行后续 `tool_use`。拒绝写工具时：当前工具仍产出 deny 的 `tool_result`，但同批后续工具（如 ReadC）无 result。`QueryEngine` 已把含全部 `tool_use` 的 assistant 写入历史；下一轮用户输入会带着孤儿 `tool_use` 调 API。

## Goals / Non-Goals

**Goals:**

- abort 跳过的每个 `tool_use` 都有合成 `tool_result`（`is_error`）
- 配对在 yield 进会话历史时即完整；本轮仍可 `aborted` 不追问模型
- 单测覆盖：Read → Write(deny+abort) → Read 跳过仍有 result

**Non-Goals:**

- 并发工具分区 / StreamingToolExecutor 全套
- 改变 deny 文案或是否 abort 的策略
- session rewind / 磁盘 transcript 修复

## Decisions

### 1. 在 `runTools` 内补齐，不在 query 层扫历史

- **选择**：`break` 前记录循环时，对剩余 block `yield` 合成 result。
- **备选**：query 在 aborted return 前扫描 parentMessage 补洞。
- **理由**：编排层最清楚「哪些还没跑」；query 保持 abort 语义即可。

### 2. 文案

稳定短文案，例如：`Skipped because a previous tool use was rejected or the turn was aborted.`（英文，与 REJECT_MESSAGE 风格一致）。可抽常量便于单测断言。

### 3. 合成路径不跑 hooks / call

跳过的工具不调用 Pre/Post、不 `call`，只 `createToolResultMessage(id, msg, true)`。

### 4. abort 时机

保持现状：REPL deny 时先 abort 再返回 deny；当前工具仍走完整 `runToolUse`（得 deny result），**下一轮循环开头**发现 aborted 则对**剩余**补合成 result 后结束（或在 break 分支里补）。

推荐结构：

```text
for block of blocks:
  if aborted:
    yield synthetic for block
    continue  // 或 for 剩余一次性补完再 return
  else:
    runToolUse → yield
```

用 `if aborted: yield synthetic; continue` 比 `break` 更清晰，避免漏补。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 历史多几条 skipped result，占上下文 | 文案短；仅 abort 路径 |
| 与「本轮不再 callModel」混淆 | 规格写明：补 result 为配对，不强制再调模型 |

## Open Questions

- （无）文案是否本地化：本 change 保持英文常量
