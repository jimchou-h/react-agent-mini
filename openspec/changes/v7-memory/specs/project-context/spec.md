## ADDED Requirements

### Requirement: Memory 与项目上下文并存

当同时存在项目说明（AGENTS/CLAUDE）与 Memory 时，系统 SHALL 两者都可进入上下文；顺序 SHALL 为项目说明在前、Memory 在后（除非配置另行指定）。

#### Scenario: 两者皆存在

- **WHEN** 目录同时有 AGENTS.md 与 Memory 文件
- **THEN** 模型上下文包含二者，且项目说明段落先于 Memory
