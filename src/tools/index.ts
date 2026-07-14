import type { Tools } from '../Tool.js'
import { EchoTool } from './EchoTool.js'
import { GrepTool } from './GrepTool.js'
import { ReadTool } from './ReadTool.js'

/**
 * 返回当前进程注册的所有内置工具
 *
 * 新工具在此数组中注册；callModel 出站时会遍历此列表生成 API tools 定义。
 * 对齐 claude-code src/tools.ts 的组装方式，v0 为静态列表。
 */
export function getTools(): Tools {
  return [EchoTool, ReadTool, GrepTool]
}
