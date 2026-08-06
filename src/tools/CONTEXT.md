# tools 模块术语表

内置工具定义与注册。源码：`src/Tool.ts`、`src/tools/`、`src/services/tools/`。

## 工具契约

| 术语 | 英文 | 说明 |
|------|------|------|
| **Tool** | tool definition | `name`、`description`、`inputSchema`（Zod）、`call()` |
| **Tools** | tools registry | `readonly Tool[]`，由 `getTools()` 提供 |
| **ToolUseContext** | tool context | `tools` + 可选 `skills` / `canUseTool` / `depth` / hooks |
| **ToolResult** | tool result | `{ data, isError? }`，`runToolUse` 序列化为 `tool_result`；`isError` → `is_error` |
| **tool_use** | tool use block | 模型请求调用工具；`AssistantMessage` 中的块类型 |
| **tool_result** | tool result block | 工具执行结果；`UserMessage` 中的块类型 |

## 执行流水线

| 术语 | 说明 |
|------|------|
| **runToolUse** | 单工具：查找 → Zod 校验 → `canUseTool` → `call()` → 构造 `tool_result` |
| **runTools** | 串行调度多个 `tool_use`（v0 无并发分区） |
| **CanUseTool** | 权限回调：`(tool, input, context) => allow \| deny` |
| **autoAllowCanUseTool** | 缺省策略：恒 `{ behavior: 'allow' }` |
| **createReplCanUseTool** | REPL：非只读工具经 `ask` 确认 `y/yes` |
| **createHeadlessCanUseTool** | headless/pipe：写工具默认 deny，`ALLOW_WRITE=1` 放行 |
| **findToolByName** | 按 `tool_use.name` 查找工具定义 |

## 内置工具

| 工具 | 只读 | 说明 |
|------|------|------|
| **Echo** | 是 | 原样返回 `message`，验证 ReAct 闭环 |
| **Read** | 是 | 读取 cwd 内 UTF-8 文件；单文件 ≤100KB；可选 `offset`/`limit` 分段 |
| **Grep** | 是 | cwd 内正则搜内容；`head_limit` 默认 50 |
| **Glob** | 是 | cwd 内 glob 列文件；最多 100 条 |
| **Skill** | 是 | 按名称返回已发现 SKILL.md 正文；未知名称返回错误 |
| **Write** | 否 | 覆盖写入 cwd 内文件；内容 ≤100KB；父目录须已存在 |
| **Edit** | 否 | 已存在文件中 `old_string`→`new_string`；默认唯一匹配；可选 `replace_all`；文件 ≤100KB |
| **Bash** | 否 | 在 cwd 执行 shell 命令；合并 stdout/stderr；超时/截断；非零退出标 `isError` |
| **Agent** | 否 | 同步嵌套 `query` 子代理；摘要回父；子池排除 `Agent`；maxDepth=1 |
| **WebSearch** | 是 | 联网搜索；Brave / Tavily；缺 Key / abort → `isError` |
| **WebFetch** | 是 | 拉取 http(s) 正文；HTML 去标签；SSRF 护栏 / abort → `isError` |

### WebSearch / WebFetch

| 术语 | 说明 |
|------|------|
| **WebSearchAdapter** | `src/services/webSearch/`：`search(query, options?)` → hits |
| **Brave adapter** | `BRAVE_API_KEY` 或 `BRAVE_SEARCH_API_KEY` |
| **Tavily adapter** | `TAVILY_API_KEY`；可选 `TAVILY_ENDPOINT_URL` |
| **WEB_SEARCH_ADAPTER** | `brave` \| `tavily`；未设且仅有 Tavily Key → tavily，否则默认 brave |
| **setWebSearchAdapterForTests** | 测试注入 mock / hanging adapter |
| **WebSearchConfigError** | 缺 Key 等配置错误 → 工具 `isError` |
| **assertSafeFetchUrl** | 仅 http(s)；拒 localhost / 私网 / 链路本地 IP |
| **fetchUrlText** | GET + 超时/大小上限 + `htmlToText`；可注入 `fetchImpl` |
| **setWebFetchImplForTests** | 测试注入 `fetch` |

**非目标：** Anthropic 服务端 search、JS 渲染、PDF/二进制解析、完整代理绕过 SSRF、可配置多 provider UI。

### Agent 专用术语

| 术语 | 说明 |
|------|------|
| **depth** | `ToolUseContext.depth` / `query({ depth })`：0 顶层，≥1 子代理 |
| **createSubagentContext** | 派生 abort 链与 depth+1（父 abort → 子 abort） |
| **toolsForSubagent** | 父工具表去掉 `Agent`，可选 `tool_names` 白名单 |
| **摘要** | 子会话末条 assistant 的 text；默认预算 32KB |
| **interrupt** | REPL 第一次 SIGINT abort 当前 turn（含同步 Agent）；空闲则退出；见 `QueryEngine.abortCurrentTurn` |

**非目标：** swarm、worktree、后台 fork、`SubagentStop`、`subagent_type` 命名 agent 目录。

### Read 专用术语

| 术语 | 说明 |
|------|------|
| **MAX_READ_BYTES** | 100 × 1024，超出返回工具错误 |
| **resolvePathUnderCwd** | 解析路径并拒绝逃出 `cwd` 的穿越访问 |
| **offset / limit** | 1-based 起始行与行数；输出 `LINE|content` |

### Write 专用术语

| 术语 | 说明 |
|------|------|
| **MAX_WRITE_BYTES** | 100 × 1024，超出返回工具错误 |
| **覆盖写** | 不自动 `mkdir`；父目录必须存在 |

### Edit 专用术语

| 术语 | 说明 |
|------|------|
| **MAX_EDIT_BYTES** | 100 × 1024，超出返回工具错误 |
| **唯一匹配** | 默认 `old_string` 须恰好出现一次，否则报错 |
| **replace_all** | 为 true 时替换全部出现 |
| **Edit vs Write** | 改片段用 Edit；新建/整文件重写用 Write |

### Bash 专用术语

| 术语 | 说明 |
|------|------|
| **MAX_BASH_OUTPUT_CHARS** | 50000，合并输出超限后截断并附提示 |
| **DEFAULT_BASH_TIMEOUT_MS** | 30000，缺省超时 |
| **MAX_BASH_TIMEOUT_MS** | 120000，`timeout_ms` 上限 |
| **超时中止** | 超时立即 resolve 并 `killTree`（Win 用 `taskkill /T /F`） |
| **shell 选择** | Win: `ComSpec /d /s /c`；其余: `SHELL -c` |
| **命令预览** | REPL 确认摘要与 CLI 状态行截断展示 `command` |

### Grep / Glob 术语

| 术语 | 说明 |
|------|------|
| **DEFAULT_GREP_HEAD_LIMIT** | 默认 50 条匹配行 |
| **MAX_GLOB_RESULTS** | 最多返回 100 个路径 |

## 注册

| 术语 | 说明 |
|------|------|
| **getTools()** | `src/tools/index.ts` 工厂，返回当前启用的工具列表 |

## 扩展指引

新增工具步骤：

1. 在 `src/tools/XxxTool.ts` 实现 `Tool` 契约
2. 注册到 `getTools()`
3. 补充单元测试与 `CONTEXT.md` 表格一行
4. 非只读工具依赖 CLI 注入的 `canUseTool`（REPL 确认 / headless `ALLOW_WRITE`）

对齐 claude-code：`packages/builtin-tools/src/tools/` 下 60+ 工具，接口形状与本仓库 `Tool.ts` 兼容。
