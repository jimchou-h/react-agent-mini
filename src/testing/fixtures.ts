import type { ToolUseContext, Tools } from '../Tool.js'
import { getTools } from '../tools/index.js'

/**
 * 构造测试/演示用的最小 ToolUseContext
 *
 * @param tools - 可选自定义工具列表；缺省使用 getTools() 默认注册表
 */
export function createMinimalToolContext(tools?: Tools): ToolUseContext {
  return { tools: tools ?? getTools() }
}
