## MODIFIED Requirements

### Requirement: MCP Prompt 经 slash 注入

系统 SHALL 通过 REPL slash 执行 MCP prompt。执行时 SHALL：

1. 调用 `prompts/get`，将结果转为 meta 消息；
2. 从该结果文本中解析 `@server:uri` 引用；若存在引用，SHALL 仅对这些引用执行 `resources/read`，并将成功读取的正文以 **meta 消息**挂入当前 turn（排在 prompt 消息之前）；
3. 若结果文本中**没有任何** `@server:uri` 引用，SHALL NOT 自动全量挂载该 server 的 Resources（对齐 claude-code；模型仍可通过 List/Read 工具拉取）；
4. SHALL NOT 将原始 slash 行作为模型 user 文本；SHALL NOT 将 MCP prompt 暴露为 Skill 工具或自动追加到持久 `systemPrompt`。

#### Scenario: 执行 MCP slash

- **WHEN** REPL 用户输入 `/demo:greet (MCP) world` 且 `demo` server 暴露 `greet` prompt
- **THEN** Host 调用 `prompts/get`（`world` 映射到声明的参数），并将结果注入当前 turn

#### Scenario: prompt 含 @server:uri 时按需挂载

- **WHEN** 执行 MCP slash，且 `prompts/get` 返回文本包含 `@tour:docs://handbook`
- **THEN** Host 仅对该 `tour` + `docs://handbook` 执行 `resources/read`，将手册正文以 meta 消息先于 prompt 注入；SHALL NOT 全量读取该 server 其它未引用资源

#### Scenario: 无 @server:uri 时不自动挂载 Resources

- **WHEN** 执行 MCP slash，且 `prompts/get` 返回文本不含任何 `@server:uri`
- **THEN** Host 不自动注入 Resource meta 消息；仅注入 prompt 内容；REPL 可不提示已挂载数量

#### Scenario: slash 不作为普通 user 输入

- **WHEN** 用户输入合法 MCP slash
- **THEN** 该输入不原样作为模型 user 文本；仅注入资源（若有引用且读成功）与 get 得到的 prompt 内容

#### Scenario: 获取失败

- **WHEN** `prompts/get` 失败
- **THEN** REPL 打印可读错误，不发起 query 或 abort 当前 turn

#### Scenario: headless 不预装 MCP slash

- **WHEN** 非 REPL 模式（headless/pipe）
- **THEN** 不自动执行 MCP slash；文档说明 prompts 为 REPL 能力
