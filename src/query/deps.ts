import { randomUUID } from 'node:crypto'
import type { CallModel } from './types.js'
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
 * - 否则：callModel 抛错，提示实现 issue #2
 */
export function productionDeps(): QueryDeps {
  if (process.env.QUERY_MOCK === '1') {
    return {
      callModel: mockEchoCallModel,
      uuid: randomUUID,
    }
  }

  return {
    callModel: notImplementedCallModel,
    uuid: randomUUID,
  }
}

/**
 * 真实 Provider 未实现时的占位 callModel
 *
 * 立即抛错，避免静默失败；引导用户使用 dev:mock 或配置 API Key。
 */
async function* notImplementedCallModel(): AsyncGenerator<never> {
  throw new Error(
    '真实模型 Provider 尚未实现（见 issue #2）。请使用 npx bun run dev:mock 或设置 QUERY_MOCK=1。',
  )
}
