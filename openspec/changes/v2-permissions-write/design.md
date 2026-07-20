## Context

`runToolUse` 当前写死 `autoAllowCanUseTool()`。引入 Write 前必须可 deny / 交互确认。对齐 claude-code `canUseTool` 钩子，但 UI 只用 REPL stdin。

## Goals / Non-Goals

**Goals:**

- `CanUseTool` 函数类型注入 `ToolUseContext` 或 `runToolUse` 参数
- 只读 → allow；Write → REPL 询问；headless 默认 deny（或 `ALLOW_WRITE=1`）
- `Write`：`path` + `content`，cwd 校验，单文件 ≤100KB

**Non-Goals:**

- Bash、权限规则文件、always-allow 记忆
- Ink 弹窗、并发写

## Decisions

### 1. canUseTool 注入点

**选择**：`ToolUseContext.canUseTool?: CanUseTool`；缺省 = `autoAllowCanUseTool`。

```ts
type CanUseTool = (
  tool: Tool,
  input: unknown,
  context: ToolUseContext,
) => Promise<CanUseToolResult>
```

`runToolUse` 调用 `context.canUseTool ?? autoAllowCanUseTool`，并对只读工具可短路由 allow。

### 2. REPL 确认策略

**选择**：若 `!tool.isReadOnly(input)`，向 stderr 打印摘要，stdin 读一行；`y`/`yes` → allow，否则 deny。

### 3. headless / pipe / mock

**选择**：

| 模式 | Write |
|------|-------|
| REPL | y/n |
| headless / pipe | deny，除非 `ALLOW_WRITE=1` |
| `QUERY_MOCK=1` | deny（测试用注入 fake canUseTool） |

### 4. Write 语义

**选择**：覆盖写入（mkdir 父目录可选：v2 不自动 mkdir，父目录必须存在）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 误确认写坏文件 | 确认提示含 path + 字节数；cwd 限制 |
| Windows stdin 与 readline 冲突 | REPL 确认复用同一 readline 接口或短暂 pause |

## Migration Plan

只读工具行为不变。新增 Write 出现在 tools 列表。

## Open Questions

- （已关闭）headless 默认 deny + `ALLOW_WRITE=1` 覆盖
- MCP 工具后续复用同一 `canUseTool`
