## ADDED Requirements

### Requirement: 能力协商后可选启用

MCP 客户端 SHALL 在 initialize 后根据 server capabilities 决定是否启用 resources/prompts 路径；缺失时 fail-soft。

#### Scenario: 仅 tools 的 server 仍可用

- **WHEN** server 只声明 tools
- **THEN** 工具发现与调用行为与 v3 一致
