## Context

当前 REPL slash 仅支持内置 `/exit` `/clear` `/help` 与 MCP `/server:prompt`。Skills 已在启动时发现并进入 system 摘要，模型可通过 `Skill` 工具注入正文，但用户无法用斜杠确定性触发。`v5-autocompact` 计划增加 `/compact`，本 change 需与之共用「内置优先」解析顺序。

## Goals / Non-Goals

**Goals:**

- 用户输入 `/<skill-id>`（可选 args）即可加载并使用该 Skill
- 注入语义与 `Skill` 工具一致（正文进会话通道，slash 原文不进模型）
- `/help` 可发现可用 Skill
- 提供 `skill-creator` 示例 Skill，演示「斜杠直达工作流」

**Non-Goals:**

- headless/pipe 的 slash Skill
- 自动补全 UI、模糊匹配多候选交互
- 改变 Skill 发现路径或 frontmatter 契约

## Decisions

### 1. 命令形状：`/<skill-id> [args...]`

- **选择**：第一段 path（去前导 `/`）精确匹配发现列表中的 `name`（目录名）；其余为 args 字符串。
- **备选**：强制 `/skill <id>` 前缀 — 更无歧义，但与 Claude Code「技能即斜杠」习惯不一致，且多打一层。
- **理由**：目录名已是稳定 ID；与 MCP 的 `server:prompt`（含 `:`）天然区分。

### 2. 解析优先级

1. 内置：`/exit` `/quit` `/clear` `/help`（及未来 `/compact`）
2. MCP：`parseMcpSlashCommand` 命中
3. Skill：精确匹配已发现 `skill.name`
4. 否则：未知 slash 提示（不送模型）

- **理由**：避免 Skill 名叫 `help` 时劫持内置；MCP 用 `:` 约定，冲突面小。

### 3. 命中后行为

- 解析到 Skill 后：
  1. 构造与 `SkillTool` 相同的注入正文（含 base directory；有 args 则附加 `Arguments:`）
  2. 若有非空 args：以 args 为 `userText` 调用 `runTurn`，并通过既有 `injectBefore`/prepend 通道先注入 Skill 正文
  3. 若无 args：仅注入 Skill 正文到会话（或打印「已加载 skill-xxx，请继续输入」并等待下一轮普通输入）

- **推荐默认**：无 args 时也开启一轮极短确认 turn 成本高；**无 args → 注入 + 打印确认，不自动 callModel**；有 args → 注入 + `runTurn(args)`。
- **备选**：无 args 也强制问模型「已加载，请按技能执行」— 多一次 API，体验更「主动」但费 token。
- **选择前者**：与「slash 确定性本地动作」一致，用户再打一句自然语言即可。

### 4. 与 Skill 工具的关系

- Slash **复用**注入格式函数（从 `SkillTool` 抽出共享 helper），不经 `runToolUse` / 不产生假 `tool_use`。
- 模型仍可随时 `Skill({ skill })`；两路并存。

### 5. 示例 `skill-creator`

- 放在 `.agents/skills/skill-creator/SKILL.md`
- 内容为精简版「如何写项目 Skill」步骤（对齐 Cursor/Codex skill-creator 原则，不整包复制）
- 验证路径：REPL `/skill-creator` → 确认已加载 → 用户说「帮我写一个 foo skill」

### 6. CLI 接线

- `runReplSession` 增加 `skills?: readonly DiscoveredSkill[]`（启动快照已有）
- `/clear` 仍不重扫 skills（与现约定一致）

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Skill 名与未来内置 slash 冲突 | 内置表优先；文档建议 Skill 目录名避免 `help`/`clear`/`exit`/`compact` |
| 无 args 只注入不跑模型，用户以为「没反应」 | 明确 stderr/stdout 确认文案：`已加载 skill: <id>` |
| 大 Skill 正文塞进历史 | 沿用 32KB 截断；与工具路径相同 |
| 与 `v5-autocompact` 并行改 `repl.ts` | 解析表做成易扩展列表；合并时注意冲突 |

## Migration Plan

1. 实现解析 + 注入 + help 列表 + 测试
2. 加入 `skill-creator` 示例
3. 更新 README：Skills 节说明 `/<id>` 用法
4. 无数据迁移；旧行为仅「未知 slash」变「命中 Skill」

## Open Questions

- （已决）无 args 是否自动 callModel → **否**，仅加载确认
- 若用户坚持「无 args 也要自动开一轮」，可后续加环境变量；本 change 不做
