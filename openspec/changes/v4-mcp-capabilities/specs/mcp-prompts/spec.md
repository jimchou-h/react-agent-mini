## ADDED Requirements

### Requirement: MCP Prompts 列表与获取

系统 SHALL 能对声明 prompts 能力的 MCP server 列出并获取提示模板。

#### Scenario: 列出 prompts

- **WHEN** server 暴露 prompts 且 Host 请求 list
- **THEN** 返回 prompt 名称与描述（若有）

#### Scenario: 获取并注入

- **WHEN** Host 获取指定 prompt
- **THEN** 其内容可注入当前会话的模型输入（system 追加或等价文档化路径），且不影响既有 tools 流程

#### Scenario: server 无 prompts

- **WHEN** server 未声明 prompts
- **THEN** 跳过该能力且不影响 tools 调用
