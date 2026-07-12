import { describe, expect, test } from 'bun:test'
import { productionDeps } from '../deps.js'
import { callModel } from '../../services/api/client.js'

describe('productionDeps', () => {
  test('binds real callModel when QUERY_MOCK is not set', () => {
    const prev = process.env.QUERY_MOCK
    delete process.env.QUERY_MOCK

    try {
      const deps = productionDeps()
      expect(deps.callModel).toBe(callModel)
    } finally {
      if (prev === undefined) {
        delete process.env.QUERY_MOCK
      } else {
        process.env.QUERY_MOCK = prev
      }
    }
  })

  test('uses mock callModel when QUERY_MOCK=1', () => {
    const prev = process.env.QUERY_MOCK
    process.env.QUERY_MOCK = '1'

    try {
      const deps = productionDeps()
      expect(deps.callModel).not.toBe(callModel)
    } finally {
      if (prev === undefined) {
        delete process.env.QUERY_MOCK
      } else {
        process.env.QUERY_MOCK = prev
      }
    }
  })
})
