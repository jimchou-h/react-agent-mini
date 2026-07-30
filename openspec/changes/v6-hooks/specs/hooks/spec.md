## ADDED Requirements

### Requirement: Hook 配置加载

系统 SHALL 能从工作区约定配置文件加载 hooks 定义（工具匹配规则 + 可执行动作）。配置缺失或 `HOOKS=0` 时 SHALL 跳过所有 hooks 且不影响工具执行。

#### Scenario: 无配置时跳过

- **WHEN** 工作区无 hooks 配置或 hooks 禁用
- **THEN** 工具执行路径与无 hooks 时一致

#### Scenario: 加载合法配置

- **WHEN** 配置文件声明某工具的 PreToolUse / PostToolUse
- **THEN** Host 在会话启动或首次工具调用前可解析到对应 hooks

### Requirement: PreToolUse / PostToolUse

系统 SHALL 在权限通过后、工具 `call` 前执行匹配的 PreToolUse；在 `call` 成功或失败后执行匹配的 PostToolUse。PreToolUse 明确 deny 时 SHALL 不调用 `call`，并向模型返回错误 `tool_result`。

#### Scenario: PreToolUse 放行后执行工具

- **WHEN** PreToolUse 成功且未 deny
- **THEN** 正常执行 `Tool.call` 并继续 PostToolUse

#### Scenario: PreToolUse deny

- **WHEN** PreToolUse 返回 deny（或配置为失败即 deny）
- **THEN** 不执行工具，返回 is_error 的 tool_result

#### Scenario: PostToolUse 失败不撤销结果

- **WHEN** 工具已执行且 PostToolUse 失败
- **THEN** 已产生的 tool_result 仍回注模型；记录警告
