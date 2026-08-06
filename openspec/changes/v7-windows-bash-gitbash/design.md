## Context

`BashTool.runCommand` 在 `win32` 上使用 `process.env.ComSpec || 'cmd.exe'` 与 `/c`。claude-code 则在启动时 `setShellIfWindows()`，把 Windows 上的 Bash 固定到 Git Bash（`bash.exe`），系统提示写明使用 Unix 语法；另有可选 `PowerShell` 工具（默认对外关闭）。

实测：模型发 `ls`/`&&`/`head` 时，`cmd.exe` 返回「文件名、目录名或卷标语法不正确」，且 OEM 中文错误在 UTF-8 解码下乱码。

## Goals / Non-Goals

**Goals:**

- Windows：`Bash` → Git Bash；非 Windows：保持现有 `SHELL`/`/bin/bash` 路径
- 解析顺序对齐 CC 精简版：`CLAUDE_CODE_GIT_BASH_PATH` → 可识别的 bash `SHELL` → 常见 Git 安装路径 / 从 `git.exe` 推断
- 找不到 bash：工具 `isError`，文案提示安装 Git for Windows 或设置路径变量
- 工具 description（及可选极短 system 一行）声明 Windows 用 Unix 语法
- 单测覆盖路径解析与「缺 bash 失败」；现有超时/截断/非零退出语义不变

**Non-Goals:**

- 独立 `PowerShell` 工具（CC 有；本 change 不做，可后续票）
- 完整 POSIX↔Win 路径双向转译层、`2>nul` 自动改写（可最小顺手，非必须）
- Bash 子进程 SIGINT 细粒度转发、沙箱
- 改动权限管道 / MCP

## Decisions

### D1：执行器 — Git Bash，不用 cmd

- **选择**：`spawn(bashPath, ['-c', command], { cwd })`
- **替代**：改用 PowerShell 当 Bash → 与工具名/模型习惯冲突，拒绝
- **替代**：保留 cmd 仅改 description → 治标不治本，拒绝

### D2：解析落位 — 小工具模块 + BashTool 调用

- **选择**：`src/utils/windowsGitBash.ts`（或 `src/tools/bash/resolveShell.ts`）导出 `resolveBashExecutable(): string | null`；`BashTool` 在 call 时解析
- **替代**：塞进 `BashTool.ts` 单文件 → 可测性差；超过一页逻辑时拆出

### D3：缺 bash 策略 — fail-closed

- **选择**：不回退 cmd；返回明确错误（对齐 CC「必须装 Git Bash」精神，mini 用工具错误而非进程 exit，避免拖垮整个 CLI）
- **替代**：CLI 启动时 `process.exit(1)` → 过重，非 Windows 用户无感，Windows 无 Git 仍可只用 Read/Write

### D4：模型提示 — description + 可选 system 一行

- **选择**：更新 `BashTool.description`；若已有 systemPrompt 拼装 seam，追加一行 `Shell: bash (Unix syntax on Windows…)` 对齐 CC `getShellInfoLine`
- **不**大改 prompts 体系

### D5：输出编码

- **选择**：继续按 UTF-8 读 pipe（与 CC 一致）；Git Bash 下中文乱码应明显少于 cmd OEM
- **不做** codepage 探测

## Risks / Trade-offs

- [用户未装 Git for Windows] → 错误文案给安装/环境变量指引；文档写清
- [企业定制 Git 路径] → `CLAUDE_CODE_GIT_BASH_PATH` 覆盖
- [cwd 含空格/特殊字符] → 沿用 spawn argv，不经 shell 二次拆分 command 主体（command 仍由 bash `-c` 解析）
- [PowerShell 用户期望] → 文档 Non-Goal；后续可加 `PowerShell` 工具

## Migration Plan

- 纯行为修复，无配置迁移
- 回滚：恢复 `ComSpec` 分支即可
- README 增加 Windows + Bash 依赖说明

## Open Questions

- 无阻塞项。PowerShell 工具是否进下一张 v7 票：默认「另开 change」，本 change 不混入。
