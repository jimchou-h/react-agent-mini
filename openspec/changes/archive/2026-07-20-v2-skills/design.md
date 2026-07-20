## Context

claude-code 的 SkillTool 支持 fork Agent、插件源、MCP prompts。mini 只做：**发现 SKILL.md + Skill 工具返回正文**。依赖 `v2-project-context` 的 system 通道列出可用技能名（可选增强）。

## Goals / Non-Goals

**Goals:**

- 扫描 `.agents/skills/*/SKILL.md` 与 `.claude/skills/*/SKILL.md`
- 解析 YAML frontmatter 的 `name`（缺省用目录名）
- `Skill` 工具：`skill` 参数 → 返回 markdown 正文
- system prompt 追加「可用 Skills 列表」（名称 + 一句话 description）

**Non-Goals:**

- 子 Agent fork、Skill 内嵌命令执行
- 用户 home 全局 skills、marketplace
- MCP（标注为 **v2.1 后续**：stdio Client + 动态 Tool 注册，复用 `canUseTool`）

## Decisions

### 1. 加载时机

**选择**：进程启动时扫描一次并缓存；`/clear` 不重新扫描（可用后续 `/reload-skills`）。

### 2. Skill 工具语义

**选择**：`tool_result` 内容 = 技能全文；由模型在后续推理中遵从。不修改 system prompt 本身。

**理由**：与「工具回注」一致，便于 TRACE 观察；避免每调一次 Skill 就改 system。

### 3. 发现失败

未知 skill 名 → `is_error` tool_result。

### 4. 与 project-context 关系

**Blocked by**：建议先合入 `v2-project-context`。Skills 列表可拼接到已有 systemPrompt 末尾。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 超大 SKILL.md | 单技能 32KB 截断 |
| 与 Read 工具重叠 | Skill 面向「具名工作流」；Read 面向任意文件 |

## Migration Plan

无破坏。无 skills 目录时列表为空，Skill 工具仍注册但调用会报未知。

## Open Questions / 后续

- **v2.1 MCP**：`@modelcontextprotocol/sdk` stdio transport → 将 MCP tools 适配为 `Tool` → 并入 `getTools()`；权限走 `v2-permissions-write` 的 `canUseTool`
