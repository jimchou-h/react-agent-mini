## 1. Memory 加载与注入

- [ ] 1.1 约定路径加载 `MEMORY.md`（缺失跳过、预算截断）+ 单测
- [ ] 1.2 启动时注入：AGENTS 先、Memory 后；与 project-context 集成 + 单测

## 2. 刷新与更新

- [ ] 2.1 轮次前按 mtime 刷新缓存（或文档化为仅启动加载）
- [ ] 2.2 写权限：仅允许写 memory 路径时走既有 Write/Edit 闸；可选 `/memory` 只读展示

## 3. 文档与验收

- [ ] 3.1 README / CONTEXT：路径、预算、与 compact 关系
- [ ] 3.2 `bun test` + typecheck；有 Memory 文件时模型上下文可见
