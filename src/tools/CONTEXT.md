# tools 模块术语表

内置工具定义与注册。源码：`src/Tool.ts`、`src/tools/`、`src/services/tools/`。

## 工具契约

| 术语 | 英文 | 说明 |
|------|------|------|
| **Tool** | tool definition | `name`、`description`、`inputSchema`（Zod）、`call()` |
| **Tools** | tools registry | `readonly Tool[]`，由 `getTools()` 提供 |
| **ToolUseContext** | tool context | v0 仅含 `tools` 列表；后续可扩展权限、MCP |
| **ToolResult** | tool result | `{ data }`，由 `runToolUse` 序列化为 `tool_result.content` |
| **tool_use** | tool use block | 模型请求调用工具；`AssistantMessage` 中的块类型 |
| **tool_result** | tool result block | 工具执行结果；`UserMessage` 中的块类型 |

## 执行流水线

| 术语 | 说明 |
|------|------|
| **runToolUse** | 单工具：查找 → Zod 校验 → `canUseTool` → `call()` → 构造 `tool_result` |
| **runTools** | 串行调度多个 `tool_use`（v0 无并发分区） |
| **autoAllowCanUseTool** | v0 权限策略：恒 `{ behavior: 'allow' }` |
| **findToolByName** | 按 `tool_use.name` 查找工具定义 |

## 内置工具（v0）

| 工具 | 只读 | 说明 |
|------|------|------|
| **Echo** | 是 | 原样返回 `message`，验证 ReAct 闭环 |
| **Read** | 是 | 读取 cwd 内 UTF-8 文件；单文件 ≤100KB |

### Read 专用术语

| 术语 | 说明 |
|------|------|
| **MAX_READ_BYTES** | 100 × 1024，超出返回工具错误 |
| **resolvePathUnderCwd** | 解析路径并拒绝逃出 `cwd` 的穿越访问 |

## 注册

| 术语 | 说明 |
|------|------|
| **getTools()** | `src/tools/index.ts` 工厂，返回当前启用的工具列表 |

## 扩展指引

新增工具步骤：

1. 在 `src/tools/XxxTool.ts` 实现 `Tool` 契约
2. 注册到 `getTools()`
3. 补充单元测试与 `CONTEXT.md` 表格一行
4. 写操作工具接入前需替换 `autoAllowCanUseTool`

对齐 claude-code：`packages/builtin-tools/src/tools/` 下 60+ 工具，接口形状与本仓库 `Tool.ts` 兼容。
