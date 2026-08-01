## Why

REPL 拒绝写工具（或其它路径）会 `abort` 并中断同轮后续工具。当前 `runTools` 直接 `break`，已发出的 `assistant.tool_use`（如 ReadC）没有对应 `tool_result`，会话历史配对断裂；下一轮 `callModel` 易触发 API 400。应对齐 Anthropic 配对规则与 claude-code「未执行工具补合成错误 result」做法。

## What Changes

- **abort / 跳过剩余工具时**：对尚未执行的每个 `tool_use` 合成 `is_error` 的 `tool_result`（标明 skipped / cancelled），再结束本轮
- **保持**：拒绝后的工具本身仍走既有 deny `tool_result`；本轮仍可 `reason: aborted` 不再追问模型
- **测试**：多工具批次中途 abort 后历史配对完整；下一轮可安全继续

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `tool-system`：串行 `runTools` 在 abort 时须补齐未执行 `tool_use` 的 result
- `react-loop`：abort 终止后消息历史仍满足 tool_use/tool_result 配对

## Impact

- **修改**：`src/services/tools/orchestration.ts`（及可能的常量文案）；`query` 相关单测 / orchestration 单测
- **行为**：abort 后 stderr/历史多几条 skipped tool_result；API 不再因孤儿 tool_use 失败
- **非目标**：并发分区、StreamingToolExecutor、改权限文案语义、rewind/UI
