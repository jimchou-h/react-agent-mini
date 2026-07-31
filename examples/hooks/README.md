# Hooks 示例

演示 PreToolUse 拦截 Bash、PostToolUse 打日志。

## 用法

将本目录 `hooks.json` 复制到工作区：

```powershell
New-Item -ItemType Directory -Force .agents | Out-Null
Copy-Item examples/hooks/hooks.json .agents/hooks.json
```

然后启动 REPL（真实或 mock）。尝试让模型跑 Bash 时，Pre hook 会 `exit 2` 拒绝；其它工具结束后 stderr 可见 `[hooks-demo] post ...`。

关闭 hooks：

```powershell
$env:HOOKS = "0"
```

可观测：

```powershell
$env:TRACE = "1"
```

stderr 会出现 `[trace] hooks.pre` / `hooks.post`。

## 安全

命令型 hook 会执行任意 shell。只把信任的仓库配置放进 `.agents/hooks.json`。
