## Context

- **状态**：retro。整批实现见 `1408c3e`（compact + Read + OLD_INIT）与 `4139c00`（init host note）。
- **起因**：用户对照 CC 时指出默认 clear / 重复 Read / init prompt 应对齐现网，而非自创精简。

## Decisions

1. **microcompact**：默认 no-op；旧 content-clear 仅 env/选项开启；不移植 time-based / cached MC。
2. **Read**：会话级 `readFileState` Map；命中则返回 CC 同文 stub，不重发全文。
3. **`/init`**：正文照搬 `OLD_INIT_PROMPT`；平台差异只加 host note，不改写 OLD 语义；NEW_INIT 另开 change。

## Risks

- [长会话无 clear] → budget / 保尾 / autocompact
- [mtime 时钟精度] → 与 CC 一样用 floor mtimeMs；Edit/Write 应 `fromRead: false` 避免误 stub
