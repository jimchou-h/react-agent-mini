## MODIFIED Requirements

### Requirement: MCP Prompt 经 slash 注入

系统 SHALL 通过 REPL slash 执行 MCP prompt。执行时 SHALL：

1. 调用 `prompts/get`，将结果转为 meta 消息；
2. 从该结果文本中解析 `@server:uri` 引用；若存在至少一个引用，SHALL 仅对这些引用执行 `resources/read`，并将成功读取的正文以 **meta 消息**挂入当前 turn（排在 prompt 消息之前）；
3. 若结果文本中**没有任何** `@server:uri` 引用，SHALL fallback：将该 prompt 所属 server 的 Resources（若有）全量读取并以 meta 消息挂入（行为与 v4-mcp-capabilities 一致）；
4. SHALL NOT 将原始 slash 行作为模型 user 文本；SHALL NOT 将 MCP prompt 暴露为 Skill 工具或自动追加到持久 `systemPrompt`。

#### Scenario: 执行 MCP slash

- **WHEN** REPL 用户输入 `/demo:greet (MCP) world` 且 `demo` server 暴露 `greet` prompt
- **THEN** Host 调用 `prompts/get`（`world` 映射到声明的参数），并将结果注入当前 turn

#### Scenario: prompt 含 @server:uri 时按需挂载

- **WHEN** 执行 MCP slash，且 `prompts/get` 返回文本包含 `@tour:docs://handbook`
- **THEN** Host 仅对该 `tour` + `docs://handbook` 执行 `resources/read`，将手册正文以 meta 消息先于 prompt 注入；SHALL NOT 因该引用而全量读取该 server 其它未引用资源

#### Scenario: 无 @server:uri 时 fallback 全量挂载

- **WHEN** 执行 MCP slash，该 server 声明 `resources`，且 `prompts/get` 返回文本不含任何 `@server:uri`
- **THEN** 该 server 的资源正文以 meta 消息先于 prompt 注入当前 turn；REPL 可提示已挂载数量

#### Scenario: slash 不作为普通 user 输入

- **WHEN** 用户输入合法 MCP slash
- **THEN** 该输入不原样作为模型 user 文本；仅注入资源（若有）与 get 得到的 prompt 内容

#### Scenario: 获取失败

- **WHEN** `prompts/get` 失败
- **THEN** REPL 打印可读错误，不发起 query 或 abort 当前 turn

#### Scenario: headless 不预装 MCP slash

- **WHEN** 非 REPL 模式（headless/pipe）
- **THEN** 不自动执行 MCP slash；文档说明 prompts 为 REPL 能力
