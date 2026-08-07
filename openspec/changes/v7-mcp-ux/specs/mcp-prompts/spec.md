## ADDED Requirements

### Requirement: MCP 发现与错误可读

REPL SHALL 以可读方式展示可用 MCP prompt（及必要时 resource 提示）。MCP 调用失败时 SHALL 打印稳定可读错误，不静默吞掉。

#### Scenario: help 含 MCP prompts

- **WHEN** 已连接含 prompts 的 server 且用户 `/help`
- **THEN** 输出包含可调用的 MCP prompt 列表信息

#### Scenario: prompt 失败可读

- **WHEN** MCP prompt 调用失败
- **THEN** 用户看到非空错误说明，会话可继续
