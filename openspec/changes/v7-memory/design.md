## Context

静态 `AGENTS.md` 无法在会话中沉淀「用户偏好 / 项目约定」。CC 有 memory 预取与 session memory；mini 先做文件型记忆 + 预算注入。

## Goals / Non-Goals

**Goals:** 持久 MEMORY 文件；启动/轮次预算内注入；受控更新路径。

**Non-Goals:** session memory compact、云端 stores、forked 摘要 agent。

## Decisions

### 1. 存储

单文件 `MEMORY.md`（路径：项目根或 `.agents/memory/MEMORY.md`，实现时定一处并文档化）。缺失则跳过。

### 2. 注入

- 启动：与 project-context 一并进入 system 或 meta 附件（明确顺序：AGENTS → MEMORY 或相反，design 定：**AGENTS 先，MEMORY 后**）
- 预算：硬上限（如 32KB），超出截断
- 每轮：若 mtime 变则刷新；否则用缓存

### 3. 更新

- 优先：`Write`/`Edit` 目标限制在 memory 路径 + 既有写权限
- 可选：`/memory` 显示路径与长度；不强制专用工具（减少表面）

### 4. 与 compact

Memory 注入在 compact 管道之外（system/附件）；不实现 session memory compact。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 污染 system 过长 | 预算截断 |
| 模型乱写 memory | 路径约束 + 写权限 |

## Open Questions

- 是否要只读 `Memory` 工具：默认不做，靠 Read 文件路径即可
