import type { z } from 'zod'
import type { AssistantMessage } from './types/message.js'
import type { DiscoveredSkill } from './skills/discover.js'

export type CanUseToolResult =
  | { behavior: 'allow' }
  | { behavior: 'deny'; message: string }

/**
 * 权限决策回调 — 对齐 claude-code canUseTool 钩子
 */
export type CanUseTool = (
  tool: Tool,
  input: unknown,
  context: ToolUseContext,
) => Promise<CanUseToolResult>

/**
 * 工具执行上下文（精简版 ToolUseContext）
 *
 * 对齐 claude-code-best 的 ToolUseContext，v0 仅保留 tools 列表。
 * 后续 issue 可扩展：权限模式、MCP 连接、readFileState、abortController 等。
 */
export type ToolUseContext = {
  /** 当前会话可用的工具注册表 */
  tools: Tools
  /** 进程启动时发现的 skills 快照 */
  skills?: readonly DiscoveredSkill[]
  /** 可选权限回调；缺省为 autoAllowCanUseTool */
  canUseTool?: CanUseTool
}

/** 只读工具数组，由 getTools() 等工厂函数提供 */
export type Tools = readonly Tool[]

/**
 * 单次工具调用的返回值
 *
 * @typeParam T - 工具业务数据类型，序列化后写入 tool_result.content
 */
export type ToolResult<T = unknown> = {
  /** 工具执行产出的结构化数据，runToolUse 会转为字符串 */
  data: T
}

/**
 * Tool 契约 — 所有内置工具的统一定义形状
 *
 * 对齐 claude-code-best/src/Tool.ts 的精简子集，便于后续直接迁移更多工具。
 */
export type Tool<Input extends z.ZodType = z.ZodType> = {
  /** 工具唯一名称，与模型 tool_use.name 对应 */
  name: string
  /** 传给模型的工具描述（OpenAI tools 定义中的 description） */
  description: string
  /** Zod schema，用于校验模型传入的 input JSON */
  inputSchema: Input
  /**
   * 执行工具逻辑
   * @param args - 经 inputSchema 校验后的参数
   * @param context - 工具执行上下文（可访问其他工具、会话状态等）
   */
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
  ): Promise<ToolResult>
  /**
   * 是否为只读操作（不修改外部状态）
   * 只读工具未来可并发执行，见 claude-code partitionToolCalls
   */
  isReadOnly(input: z.infer<Input>): boolean
  /**
   * 是否可与其他工具并发执行
   * v0 全部串行，但接口需预留
   */
  isConcurrencySafe(input: z.infer<Input>): boolean
  /** 工具是否启用（feature flag / 配置禁用时可返回 false） */
  isEnabled(): boolean
}

/**
 * 按名称在工具列表中查找工具
 *
 * @param tools - 当前注册的工具数组
 * @param name - 模型 tool_use 中的 name 字段
 * @returns 匹配的工具定义，未找到则为 undefined
 */
export function findToolByName(tools: Tools, name: string): Tool | undefined {
  return tools.find(t => t.name === name)
}

/**
 * v0 权限策略：恒允许所有工具执行
 *
 * 不弹出确认框，不阻塞。Read/Bash 等敏感工具在后续 issue 接入真实权限流水线。
 */
export const autoAllowCanUseTool: CanUseTool = async () => {
  return { behavior: 'allow' }
}

/**
 * 工具执行时的父级 assistant 消息
 *
 * claude-code 的 runToolUse 需要 parentMessage 做审计/钩子；
 * v0 未使用，但签名保留以便扩展。
 */
export type ToolParentMessage = AssistantMessage
