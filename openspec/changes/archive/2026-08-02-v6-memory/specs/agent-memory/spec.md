## ADDED Requirements

### Requirement: 项目 Memory 文件加载

系统 SHALL 在启动会话时尝试加载约定路径的 Memory 文件；缺失时静默跳过。加载内容 SHALL 按预算截断后注入模型上下文（system 或等价附件），且与 `AGENTS.md` / `CLAUDE.md` 项目上下文并存。

#### Scenario: 存在 Memory 文件时注入

- **WHEN** 约定路径存在可读 Memory 文件
- **THEN** 本会话模型请求包含该内容（受预算限制）

#### Scenario: 缺失时不影响启动

- **WHEN** Memory 文件不存在
- **THEN** 启动成功；system prompt 仍含 Memory 路径与 remember 写入指引（可标明 MEMORY.md 为空），不因缺失而失败

### Requirement: Memory 行为指引

系统 SHALL 在 system prompt（或等价通道）中始终提供约定路径与写入指引：用户明确要求 remember 时 SHALL 指示模型用 Write/Edit 更新该 `MEMORY.md`，且 SHALL NOT 鼓励改用其它随意笔记路径存放跨会话记忆。启动时 SHALL 尽量确保 Memory 目录存在（对齐 harness 预创建目录，便于直接 Write）。

#### Scenario: 空文件仍有路径指引

- **WHEN** 会话启动且 Memory 文件缺失或为空
- **THEN** 模型上下文仍包含 `.agents/memory/MEMORY.md`（或解析后的绝对路径）及 remember 相关说明

### Requirement: Memory 预算

单次注入的 Memory 正文 SHALL 不超过配置上限；超出则截断并可不阻断会话。

#### Scenario: 超大 Memory 截断

- **WHEN** Memory 文件超过预算
- **THEN** 仅注入截断后的前缀，会话仍可运行
