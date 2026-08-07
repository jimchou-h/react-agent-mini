## Why

调用 `Skill`（如 `skill-creator`）成功后，下一轮模型请求被 OpenAI 兼容 API 拒绝：`An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'`。根因是编排层把 Skill 正文（纯文本 user 消息）插在 `tool_result` **之前**，破坏了 `assistant(tool_calls)` 后必须紧跟 `role:tool` 的配对约束。会话一旦污染，后续用户输入也会持续 400。

## What Changes

- **编排顺序**：`runTools` 对带 `prependMessages` 的工具（Skill）改为先 yield `tool_result`，再 yield 注入正文（对齐 claude-code：`addToolResult` 后再 push `newMessages`）。
- **规格**：明确 Skill 注入消息 MUST 出现在对应 `tool_result` 之后；OpenAI 适配后 `role:tool` MUST 紧邻 `assistant.tool_calls`。
- **回归测试**：orchestration 顺序、adapter 出站顺序、skill smoke 第二轮 `callModel` 历史顺序。
- 无 **BREAKING** 对外 API；仅修正错误顺序。字段名 `prependMessages` 保留（历史命名），语义为「附加注入消息」。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `skill-system`：Skill 正文注入相对 `tool_result` 的顺序约束
- `tool-system`：编排层对 `prependMessages` 的 yield 顺序
- `deepseek-provider`：出站后 `role:tool` 必须紧跟含 `tool_calls` 的 assistant（Skill 注入场景）

## Impact

- `src/services/tools/orchestration.ts`：yield 顺序
- `src/Tool.ts` / `execution.ts` / `SkillTool.ts`：注释与语义说明
- 测试：`orchestration.test.ts`、`adapter.test.ts`、`skill.smoke.test.ts`
- 用户侧：已污染会话需 `/clear` 或重启 REPL 后再试
