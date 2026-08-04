import { EventEmitter } from 'node:events'
import { describe, expect, test } from 'bun:test'
import { installTurnInterrupt } from '../turnInterrupt.js'

describe('installTurnInterrupt', () => {
  test('emits abort when turn in progress', () => {
    const target = new EventEmitter()
    let aborted = false
    let idle = false
    const handle = installTurnInterrupt({
      abortCurrentTurn: () => {
        aborted = true
        return true
      },
      onIdleInterrupt: () => {
        idle = true
      },
      target,
    })

    target.emit('SIGINT')
    expect(aborted).toBe(true)
    expect(idle).toBe(false)
    handle.dispose()
  })

  test('idle interrupt when abortCurrentTurn returns false', () => {
    const target = new EventEmitter()
    let idle = false
    const handle = installTurnInterrupt({
      abortCurrentTurn: () => false,
      onIdleInterrupt: () => {
        idle = true
      },
      target,
    })

    target.emit('SIGINT')
    expect(idle).toBe(true)
    handle.dispose()
  })
})
