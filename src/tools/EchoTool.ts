import { z } from 'zod'
import type { Tool } from '../Tool.js'

/** Echo 工具的 Zod 入参 schema，同时用于生成 OpenAI tools JSON Schema */
const echoInputSchema = z.object({
  message: z.string().describe('要原样返回的文本'),
})

/**
 * Echo 工具 — ReAct 闭环验证用
 *
 * 行为：将 message 参数原样返回，不访问文件系统、网络或子进程。
 * 用途：issue #1 验证 query → runTools → tool_result → 下一轮 model 全链路。
 */
export const EchoTool: Tool<typeof echoInputSchema> = {
  name: 'Echo',
  description: '原样返回 message 参数，用于测试工具调用链路',
  inputSchema: echoInputSchema,

  /**
   * 执行 Echo：直接返回入参 message
   * @param args.message - 要回显的字符串
   */
  async call(args) {
    return { data: args.message }
  },

  /** 只读：不修改任何外部状态 */
  isReadOnly() {
    return true
  },

  /** 可并发：无共享状态，未来可多 tool_use 并行执行 */
  isConcurrencySafe() {
    return true
  },

  /** v0 始终启用 */
  isEnabled() {
    return true
  },
}
