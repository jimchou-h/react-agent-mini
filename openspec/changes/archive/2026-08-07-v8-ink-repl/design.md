## Context

本仓引擎是 CC 子集；UI 要从 readline 升到接近 CC 的 Ink REPL。用户选定 **方案 B**（vendor `@anthropic/ink` + 裁剪接入 CC UI），且 **UI 不要求学习向**，但要求 **后续对齐 CC 容易升级迭代**。

约束：headless/pipe 不动；权限/interrupt/slash 等 v7 行为规格保持；不引入与 CC 分叉过大的自研组件树。

## Goals / Non-Goals

**Goals:**

- Vendor 并可运行 `@anthropic/ink`，Ink REPL 成为默认交互
- UI 目录与关键符号尽量对齐 CC，便于日后 diff / 重拷 / 部分 cherry-pick
- Host Bridge 隔离引擎差异；缺能力用 stub，而不是改写 CC 组件深处
- 在本仓已有能力面上达到接近 CC 的日常 REPL 体验（transcript、流式、PromptInput、权限、slash 建议、状态行、interrupt）
- 文档化「跟随 CC 升级」步骤与 pin 版本

**Non-Goals（v8）：**

- 不实现本仓尚未具备的引擎能力（完整 plan 模式、AskUserQuestion 业务、sandbox、子 agent UI 全套等）——仅 stub 以免 UI 崩溃
- 不追求与 CC 像素级/全文件无裁剪一致
- 不把 headless/pipe 改成 Ink
- 不把业务逻辑沉进 vendored ink 包内部（ink 包保持「近似 upstream」）

## Decisions

### D1：Vendor `@anthropic/ink` 为 workspace 包

- **选择**：从 CC 树拷贝 `packages/@ant/ink` → 本仓 `packages/@anthropic/ink`（`package.json` name 保持 `@anthropic/ink`），根依赖 `"@anthropic/ink": "workspace:*"`，与 CC 一致
- **替代**：官方 npm `ink` → 拒绝（与 B 及后续对齐冲突）
- **升级**：优先整包替换 + 跑 ink 冒烟；本地补丁尽量少，必需补丁记入 `packages/@anthropic/ink/PATCHES.md`

### D2：UI 树路径对齐 CC（可加薄前缀）

- **选择**：应用 UI 使用与 CC 相同的相对布局，例如：
  - `src/screens/REPL.tsx`
  - `src/components/Messages.tsx`、`PromptInput/`、`permissions/`、…
  - `src/hooks/…`（按需）
  - 启动：`src/entrypoints/cli.ts` → `launchRepl` 风格装配（可自 `replLauncher` 裁剪）
- **已拍板**：UI 根为 **`src/ui/`**，内部镜像 CC 相对路径（`src/ui/screens/REPL.tsx`、`src/ui/components/…` 等）；映射写入 `docs/ui-upstream.md`
- **替代**：自研 `src/ink/App` 组件名 → 拒绝（后续对齐成本高）；直接铺满 `src/` 根 → 拒绝（与现有 tools/services 混杂）

### D3：Host Bridge 是唯一引擎接缝（升级枢纽）

- **选择**：新增 `src/host/`（名称可调）：
  - `HostBridge`：订阅/驱动 `QueryEngine.runTurn` yields → UI 所需 streaming/messages/tool 队列
  - `createHostAskFn`：把权限队列接到 `canUseTool` / session rules
  - `slashHost`：复用本仓内置/MCP/Skill 解析，供 PromptInput 建议与执行
  - `interruptHost`：把 Ctrl+C 映射到既有三段 interrupt 状态机
  - `stubs/*`：对 UI import 到但本仓无的模块返回 no-op / 空 UI / 关闭 feature flag
- **规则**：从 CC 新拷的组件若依赖新 API，**先扩 Bridge/stub，再改组件**；避免在组件内直接 `import` 本仓 `QueryEngine` 造成缠结
- **替代**：把 QueryEngine 调用写进 REPL.tsx → 拒绝（后续无法干净换 CC 新版 REPL）

### D4：裁剪策略 — stub 优于删改

- **选择**：对暂不支持的 CC UI 分支：feature flag 关闭或 stub 组件占位，保留 import 图稳定
- **删除**：仅当文件强烈依赖无法 stub 的原生/NAPI 且 v8 无用时才剔除，并在 `UPSTREAM.md` 列出
- **v8 必接**：Messages（含流式文本）、PromptInput（提交+`/` 建议）、Status/Spinner、基础主题/App 壳
- **权限 UI（已拍板）**：**能搬就搬**——从 CC `permissions/` 迁入本仓工具能对上的专用对话框（如 Bash / FileEdit / FileWrite / Fallback 等），经 Bridge 把确认结果映射到 `y`/`n`/`a` 与 session rules；对不上的工具走 Fallback，缺引擎能力的对话框 stub，不在组件内发明第二套权限语义
- **v8 可关**：AlternateScreen 默认关（env 可开）；Vim、鼠标选区增强、与本仓无关的权限对话框 stub

### D5：流式与 headless 分叉

- **选择**：Ink 路径只经 Bridge 消费 yields；`consumeQueryStream` 保留给 headless/pipe
- **替代**：Ink 下 stdout.write → 拒绝

### D6：来源 pin 与升级剧本

- **选择**：仓库增加 `docs/ui-upstream.md`（或 `openspec` 外的短文档）：
  - pin：claude-code（claude-code-best）commit/tag
  - 同步清单：`packages/@anthropic/ink`、`src/**` UI 路径、stubs 核对表
  - 升级步骤：更新 pin → 重拷 ink → 重拷选定 UI 文件 → 跑 stub 编译 → 修 Bridge → 测
- **目标**：对齐 CC 新版本时，**主成本在 Bridge/stub**，不在重写交互逻辑

### D7：依赖

- React 19 + `react-reconciler` 等与 ink 包 peer/依赖对齐 CC
- Bun 跑 TS/TSX；测试：控制器单测 + 关键 Bridge 测 + 有限 Ink 冒烟；Windows WT 手工验收

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| CC UI 依赖面远大于本仓引擎 | stub + 裁剪清单；Bridge 集中缺口 |
| 重拷后 merge 冲突 | 少改 vendored 文件；本地差异限于 Bridge 与 stubs |
| `@anthropic/ink` 体积与 Windows 行为 | v8 冒烟清单；PATCHES 记录平台补丁 |
| REPL.tsx 过大难一次搬完 | 分任务：先壳+Messages+Input+权限，再加 typeahead/全屏 |
| 许可/归属 | UPSTREAM 注明来源与私有学习仓库用途 |

## Migration Plan

1. Vendor ink 包 → 最小 `createRoot` + `<Text>` 冒烟  
2. App 壳 + HostBridge 空转 + PromptInput 提交到 `runTurn`  
3. Messages 流式 + 工具行  
4. 迁入可对齐的 permissions 专用框 + Fallback；Bridge 映射 `y/n/a`  
5. slash 建议/执行接本仓解析  
6. interrupt 三段  
7. 默认入口切 Ink；写 `docs/ui-upstream.md`；更新 architecture  
8. 回滚：git revert / 切回 readline 标签（开发期可暂留 `REPL_UI=readline`）

## Open Questions

- （已决）UI 根：`src/ui/`；权限专用框：能搬就搬，其余 Fallback/stub
- AlternateScreen 默认关（env 可开）——若实现中与搬来的布局强耦合再评估，变更须更新本 design 与 `ui-upstream.md`
