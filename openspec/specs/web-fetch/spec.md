# web-fetch Specification

## Purpose

内置 `WebFetch` 工具：拉取 http(s) 页面并返回可读文本，含 SSRF 护栏与 abort。

## Requirements

### Requirement: WebFetch 工具

系统 SHALL 提供内置 `WebFetch` 工具，接受必填 `url`。系统 SHALL 拉取 http(s) 资源并返回可读文本（可截断），遵守超时与大小上限。

#### Scenario: 成功拉取

- **WHEN** 模型调用 `WebFetch` 且 URL 返回文本 HTML/纯文本
- **THEN** tool_result 含可读正文（或截断正文）

#### Scenario: 拒绝危险 URL

- **WHEN** URL 为非 http(s) 或明显私网/元数据地址
- **THEN** 返回 is_error，不发起不安全请求

### Requirement: WebFetch 可中止

拉取过程 SHALL 尊重 abort signal。

#### Scenario: 拉取中 abort

- **WHEN** WebFetch 进行中 signal aborted
- **THEN** 调用结束且不再继续读 body
