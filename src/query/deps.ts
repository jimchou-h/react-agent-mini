import { randomUUID } from 'node:crypto'
import type { CallModel } from './types.js'
import { callModel } from '../services/api/client.js'
import { mockEchoCallModel } from '../services/api/mock.js'

/**
 * query 循环的外部依赖集合
 *
 * 对齐 claude-code src/query/deps.ts：将 IO 与循环逻辑分离，
 * 单元测试注入 fake callModel，无需 mock.module 污染全局。
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
}

/**
 * 生产环境默认依赖
 *
 * - QUERY_MOCK=1 或 CLI --mock：使用 mockEchoCallModel，无需 API Key
 * - 否则：绑定真实 DeepSeek callModel
 */
export function productionDeps(): QueryDeps {
  if (process.env.QUERY_MOCK === '1') {
    return {
      callModel: mockEchoCallModel,
      uuid: randomUUID,
    }
  }

  return {
    callModel,
    uuid: randomUUID,
  }
}
