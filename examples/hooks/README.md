# Hooks 示例

演示 PreToolUse 拦截 Bash、PostToolUse 打日志、Stop 在顶层 completed 时收尾。

## 用法

将本目录 `hooks.json` 复制到工作区：

```powershell
New-Item -ItemType Directory -Force .agents | Out-Null
Copy-Item examples/hooks/hooks.json .agents/hooks.json
```

然后启动 REPL（真实或 mock）。尝试让模型跑 Bash 时，Pre hook 会 `exit 2` 拒绝；其它工具结束后 stderr 可见 `[hooks-demo] post ...`；一轮正常结束后 stderr 可见 `[hooks-demo] stop ...`。

### Stop 演示模式

| `STOP_DEMO` | 行为 |
|-------------|------|
| （空） | exit 0，只打日志 |
| `block` | exit 2 → 注入 `Stop hook feedback:` 再进模型一轮 |
| `prevent` | stdout `{ "continue": false }` → 直接结束 |

```powershell
$env:STOP_DEMO = "block"   # 或 "prevent"
```

关闭 hooks：

```powershell
$env:HOOKS = "0"
```

可观测：

```powershell
$env:TRACE = "1"
```

stderr 会出现 `[trace] hooks.pre` / `hooks.post` / `hooks.stop`。

## 安全

命令型 hook 会执行任意 shell。只把信任的仓库配置放进 `.agents/hooks.json`。
