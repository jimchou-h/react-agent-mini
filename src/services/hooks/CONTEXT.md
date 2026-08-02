# hooks 模块术语表

用户可配置的工具生命周期钩子（PreToolUse / PostToolUse / Stop）。源码：`src/services/hooks/`。

## 核心术语

| 术语 | 说明 |
|------|------|
| **`.agents/hooks.json`** | 工作区 hooks 配置；缺失则跳过 |
| **PreToolUse** | `canUseTool` 通过后、`Tool.call` 前；可 deny |
| **PostToolUse** | `call` 结束后；失败只警告，不撤销 tool_result |
| **Stop** | 顶层 `query` 正常 completed（无 tool_use）时；#88 为 observe-only |
| **matcher** | 工具名精确匹配，或 `*` 匹配全部（Stop 忽略 matcher） |
| **command** | 经 shell 执行的命令；stdin 写入 JSON payload |
| **exit 2** | PreToolUse deny；Stop 的 exit 2 blocking 续跑见 #89 |
| **permissionDecision** | stdout 末行 JSON：`permissionDecision`/`decision`=`deny` 亦可 deny |
| **denyOnFailure** | Pre：非 0 退出按 deny；缺省 fail-soft 放行 |
| **HOOKS=0** | 禁用所有 hooks（不读配置） |
| **TRACE** | `TRACE=1` 时输出 `hooks.pre` / `hooks.post` / `hooks.stop` |
| **depth** | `query` 嵌套深度；仅 `depth === 0` 跑 Stop |

## 执行顺序

```
validateInput → canUseTool → PreToolUse → Tool.call → PostToolUse
…
query completed (depth=0) → Stop
```

## 限制

- Stop：#88 仅触发与 fail-soft；exit 2 续跑 / `continue: false` 见后续票
- 命令型 hook 可执行任意 shell：只信任本工作区配置；生产请审慎
- 默认超时 5s；超时视为失败（exit 124）
