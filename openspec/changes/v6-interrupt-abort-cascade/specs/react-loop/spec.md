## ADDED Requirements

### Requirement: callModel 接收 abort signal

`query` 在调用 `callModel` 时 SHALL 传入当前 `toolUseContext.abortController` 的 `signal`（若存在）。当该 signal 在流式调用期间 aborted 时，本轮 SHALL 结束为 `{ reason: 'aborted' }`（或既有等价中止路径），SHALL NOT 将可识别的 abort 当作未处理的致命崩溃向上抛出。

#### Scenario: 流式生成中 abort

- **WHEN** `callModel` 正在 yield `text_delta` / assistant 过程中，`abortController` 被 abort
- **THEN** 模型流停止继续产出，`query` 返回 `{ reason: 'aborted' }`

#### Scenario: signal 透传到 deps.callModel

- **WHEN** `toolUseContext.abortController` 存在且 `query` 发起一轮模型调用
- **THEN** 传给 `deps.callModel` 的参数包含同一 `signal`
