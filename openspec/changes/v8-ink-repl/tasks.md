## 1. Vendor 与冒烟

- [x] 1.1 迁入 `packages/@anthropic/ink`（源自 CC `@ant/ink`），根 `package.json` workspace 依赖对齐；记录 pin 到 `docs/ui-upstream.md`
- [x] 1.2 最小 `createRoot` + 文本冒烟可在 Bun 下渲染；补充 `PATCHES.md` 占位（若有平台补丁）

## 2. Host Bridge 与入口竖切

- [x] 2.1 实现 `src/host/`（Bridge：runTurn yields → UI 模型；AskFn；slash 注册表；interrupt 触发）；单测不依赖完整 REPL
- [x] 2.2 裁剪装配 `launchRepl` + App 壳；`cli.ts` REPL 分支进入 Ink；headless/pipe 回归绿

## 3. Messages + PromptInput 竖切

- [x] 3.1 按 CC 相对路径接入 Messages/transcript（允许 `src/ui/` 前缀）；流式文本经 Bridge 更新
- [x] 3.2 接入 PromptInput：Enter 提交普通 turn；空行跳过；与本仓 `QueryEngine` 历史连续

## 4. 权限与状态竖切

- [ ] 4.1 迁入 CC `permissions/` 中与本仓工具可对齐的专用对话框（Bash / FileEdit / FileWrite 等）+ Fallback；经 Bridge 接 `createReplCanUseTool` / session `a`；确认中防误提交；对不上的走 Fallback/stub
- [ ] 4.2 Spinner/StatusLine：运行中指示 + 轮次结束 ctx %

## 5. Slash、interrupt、stub

- [ ] 5.1 `/` 建议接本仓内置/MCP/Skill；执行优先级与未知 slash 行为不变
- [ ] 5.2 Ink 路径接通 idle/running/cleanup interrupt；缺能力模块 stub/feature 关闭且不崩溃
- [ ] 5.3 默认 Ink 入口；更新 architecture/README；`ui-upstream.md` 含升级步骤；Windows WT 手工验收

## 6. 升级友好性收尾

- [ ] 6.1 核对：UI 内无直接深耦合 `QueryEngine`（仅经 Bridge）；vendored ink 本地 diff 最小化并文档化
- [ ] 6.2 `bun test` + `typecheck` 通过
