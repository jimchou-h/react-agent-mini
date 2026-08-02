## ADDED Requirements

### Requirement: 项目 Memory 文件加载

系统 SHALL 在启动会话时尝试加载约定路径的 Memory 文件；缺失时静默跳过。加载内容 SHALL 按预算截断后注入模型上下文（system 或等价附件），且与 `AGENTS.md` / `CLAUDE.md` 项目上下文并存。

#### Scenario: 存在 Memory 文件时注入

- **WHEN** 约定路径存在可读 Memory 文件
- **THEN** 本会话模型请求包含该内容（受预算限制）

#### Scenario: 缺失时不影响启动

- **WHEN** Memory 文件不存在
- **THEN** 启动成功，无 memory 注入

### Requirement: Memory 预算

单次注入的 Memory 正文 SHALL 不超过配置上限；超出则截断并可不阻断会话。

#### Scenario: 超大 Memory 截断

- **WHEN** Memory 文件超过预算
- **THEN** 仅注入截断后的前缀，会话仍可运行
