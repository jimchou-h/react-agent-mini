## Issue map

| Issue | Tasks | Blocked by |
|-------|-------|------------|
| [#103](https://github.com/jimchou-h/react-agent-mini/issues/103) Windows Git Bash 执行器 | 1.1–1.2 | — |
| [#104](https://github.com/jimchou-h/react-agent-mini/issues/104) Unix 语法提示与文档 | 2.1–2.2 | #103 |

## 1. Windows Git Bash 执行器

- [ ] 1.1 实现 `resolveBashExecutable`（`CLAUDE_CODE_GIT_BASH_PATH` → bash `SHELL` → 常见路径 / 从 git 推断）；单测可注入 fs/path
- [ ] 1.2 `BashTool`：win32 用解析到的 bash + `-c`；找不到则 `isError` 明确提示；非 win32 保持原行为；补「缺 bash / 成功路径」单测

## 2. 模型提示与文档

- [ ] 2.1 更新 `Bash` description（及可选 system shell 信息行）：Windows 用 Unix/bash 语法
- [ ] 2.2 README / `src/tools/CONTEXT.md`：Windows 需 Git for Windows；环境变量覆盖说明
