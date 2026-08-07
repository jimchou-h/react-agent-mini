## ADDED Requirements

### Requirement: 压缩结果可观测

当发生实质 compact 或 autocompact 时，系统 SHALL 向用户或 TRACE 提供可理解的前后占用/摘要反馈。无实质变化时可不刷屏。

#### Scenario: 手动 compact 打印前后

- **WHEN** 用户执行 `/compact` 且成功
- **THEN** 输出包含压缩前后占用信息

#### Scenario: 无变化不噪声

- **WHEN** compact 未改变消息
- **THEN** 不输出误导性「已大幅压缩」类文案
