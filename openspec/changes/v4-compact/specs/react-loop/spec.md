## ADDED Requirements

### Requirement: query 在阈值路径下仍出站-only

`query()` 应用 compact 时 SHALL 继续只修改发往模型的副本，不强制写回会话内存。

#### Scenario: microcompact 后内存可仍完整

- **WHEN** 出站发生了 microcompact
- **THEN** `deps.callModel` 入参已占位/裁剪，而传入 query 的历史数组可保持未占位原文（出站-only）
