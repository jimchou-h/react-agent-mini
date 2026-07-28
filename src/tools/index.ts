/**
 * 内置工具注册表
 *
 * `getTools()` 返回静态列表；MCP Resource 两工具不在这里，
 * 由 sessionTools() 在检测到 resources 能力时动态追加。
 */

import type { Tools } from '../Tool.js'
import { BashTool } from './BashTool.js'
import { EchoTool } from './EchoTool.js'
import { EditTool } from './EditTool.js'
import { GlobTool } from './GlobTool.js'
import { GrepTool } from './GrepTool.js'
import { ReadTool } from './ReadTool.js'
import { SkillTool } from './SkillTool.js'
import { WriteTool } from './WriteTool.js'

/**
 * 返回当前进程注册的所有内置工具
 *
 * 新工具在此数组中注册；callModel 出站时会遍历此列表生成 API tools 定义。
 * 对齐 claude-code src/tools.ts 的组装方式，v0 为静态列表。
 */
export function getTools(): Tools {
  return [
    EchoTool,
    ReadTool,
    GrepTool,
    GlobTool,
    SkillTool,
    WriteTool,
    EditTool,
    BashTool,
  ]
}
