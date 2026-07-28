/**
 * query 循环的外部依赖（callModel / uuid / microcompact）
 *
 * 生产走 DeepSeek；QUERY_MOCK=1 时用 mockEchoCallModel。
 * 测试可注入假依赖，不必 mock.module。
 */

import { randomUUID } from 'node:crypto'
import type { CallModel } from './types.js'
import type { CompactOptions, MicrocompactFn } from '../services/compact/compact.js'
import { microcompactMessages } from '../services/compact/compact.js'
import { callModel } from '../services/api/client.js'
import { mockEchoCallModel } from '../services/api/mock.js'

/**
 * query 循环的外部依赖集合
 *
 * 对齐 claude-code src/query/deps.ts：将 IO 与循环逻辑分离，
 * 单元测试注入 fake callModel / microcompact，无需 mock.module 污染全局。
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
}

/**
 * 生产环境默认依赖
 *
 * - QUERY_MOCK=1 或 CLI --mock：使用 mockEchoCallModel，无需 API Key
 * - 否则：绑定真实 DeepSeek callModel
 * - microcompact 默认绑定本地确定性实现
 */
export function productionDeps(): QueryDeps {
  const microcompact: MicrocompactFn = (messages, options?: CompactOptions) =>
    microcompactMessages(messages, options)

  if (process.env.QUERY_MOCK === '1') {
    return {
      callModel: mockEchoCallModel,
      uuid: randomUUID,
      microcompact,
    }
  }

  return {
    callModel,
    uuid: randomUUID,
    microcompact,
  }
}
