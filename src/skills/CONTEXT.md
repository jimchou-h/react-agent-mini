# skills 模块术语表

工作区 Skill 的发现、摘要与按需加载。源码：`src/skills/`、`src/tools/SkillTool.ts`。

## 核心概念

| 术语 | 英文 | 说明 |
|------|------|------|
| **Skill** | skill | 具名 Markdown 工作流，文件名固定为 `SKILL.md` |
| **技能发现** | discovery | 扫描 `.agents/skills/*` 与 `.claude/skills/*` |
| **DiscoveredSkill** | discovered skill | `{ name, description?, body, path }` |
| **技能目录摘要** | skill catalog | 名称与 description 列表，常驻 system prompt |
| **Skill 工具** | `SkillTool` | 按名称返回正文的只读工具；未知名称产生错误 tool_result |
| **Skill slash** | `/<skill-id>` | REPL 直达入口；与工具共用调用 ID（目录名）与注入格式 |
| **会话快照** | session context | CLI 启动时扫描一次；REPL `/clear` 不重扫 |

## Slash 行为

| 输入 | 行为 |
|------|------|
| `/echo-demo` | 注入正文 + 打印确认；**不** callModel |
| `/echo-demo args…` | 注入（含 Arguments）+ `runTurn(args)` |
| 优先级 | 内置 → MCP → Skill → 未知提示 |

## 边界

- frontmatter 至少支持 `name` / `description`；缺少 `name` 回退目录名
- 单技能正文最多 32KB
- `Skill` / slash 注入正文到会话通道，不修改 system prompt
- 不包含用户 home 全局 skills、fork Agent、MCP 或 marketplace
- headless/pipe 不解析 Skill slash（仅 REPL）

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/skills/discover.ts` | 扫描、frontmatter 解析、截断 |
| `src/skills/inject.ts` | `formatSkillInjection`（工具与 slash 共用） |
| `src/skills/slash.ts` | `parseSkillSlash` |
| `src/skills/systemPrompt.ts` | `buildSystemPrompt()`、`loadSessionContext()`（含 Memory） |
| `src/tools/SkillTool.ts` | 按名称读取会话 skills 快照 |
| `src/entrypoints/repl.ts` | Skill slash 接线与 `/help` 列表 |
| `src/services/memory/` | Memory 文件加载与刷新（见该目录 CONTEXT） |

注入顺序：项目说明 → Memory → Skills 目录。
