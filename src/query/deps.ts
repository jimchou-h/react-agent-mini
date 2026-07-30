/**
 * query 循环的外部依赖（callModel / uuid / microcompact / autocompact）
 *
 * 生产走 DeepSeek；QUERY_MOCK=1 时用 mockEchoCallModel。
 * 测试可注入假依赖，不必 mock.module。
 */

import { randomUUID } from 'node:crypto'
import type { CallModel } from './types.js'
import type { CompactOptions, MicrocompactFn } from '../services/compact/compact.js'
import { microcompactMessages } from '../services/compact/compact.js'
import {
  autoCompactIfNeeded,
  createSummarizeFromCallModel,
  type AutocompactFn,
} from '../services/compact/autoCompact.js'
import { callModel } from '../services/api/client.js'
import { mockEchoCallModel } from '../services/api/mock.js'

/**
 * query 循环的外部依赖集合
 *
 * 对齐 claude-code src/query/deps.ts：将 IO 与循环逻辑分离，
 * 单元测试注入 fake callModel / microcompact / autocompact。
 */
export type QueryDeps = {
  /**
   * 调用大模型并流式返回 assistant 内容
   * 生产环境绑定 DeepSeek 适配层（issue #2），测试/mock 可替换
   */
  callModel: CallModel
  /**
   * 生成唯一 ID（tool_use_id、会话 id 等）
   * 默认使用 crypto.randomUUID
   */
  uuid: () => string
  /**
   * 出站 microcompact — 对齐 claude-code `deps.microcompact`
   *
   * 低于阈值时原样返回；可注入 no-op 做单测。
   */
  microcompact: MicrocompactFn
  /**
   * LLM autocompact — 超阈值时写回会话摘要
   *
   * 可注入 no-op；默认用 callModel 做侧路摘要。
   */
  autocompact: AutocompactFn
}

/**
 * 生产环境默认依赖
 *
 * - QUERY_MOCK=1 或 CLI --mock：使用 mockEchoCallModel，无需 API Key
 * - 否则：绑定真实 DeepSeek callModel
 * - microcompact / autocompact 默认绑定本地实现
 */
export function productionDeps(): QueryDeps {
  const microcompact: MicrocompactFn = (messages, options?: CompactOptions) =>
    microcompactMessages(messages, options)

  const model: CallModel =
    process.env.QUERY_MOCK === '1' ? mockEchoCallModel : callModel
  const summarize = createSummarizeFromCallModel(model)
  const tracking = { consecutiveFailures: 0 }
  const autocompact: AutocompactFn = (messages, options) =>
    autoCompactIfNeeded(messages, {
      summarize: options?.summarize ?? summarize,
      force: options?.force,
      thresholdPercent: options?.thresholdPercent,
      keepRecentMessages: options?.keepRecentMessages,
      systemPrompt: options?.systemPrompt,
      usage: options?.usage,
      tracking: options?.tracking ?? tracking,
    })

  return {
    callModel: model,
    uuid: randomUUID,
    microcompact,
    autocompact,
  }
}
