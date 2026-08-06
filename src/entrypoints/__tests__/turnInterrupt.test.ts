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

  test('idle first interrupt does not exit immediately', () => {
    const target = new EventEmitter()
    let idle = false
    const handle = installTurnInterrupt({
      abortCurrentTurn: () => false,
      onIdleInterrupt: () => {
        idle = true
      },
      now: () => 100,
      target,
    })

    target.emit('SIGINT')
    expect(idle).toBe(false)
    handle.dispose()
  })

  test('idle second interrupt within window exits', () => {
    const target = new EventEmitter()
    let idle = false
    let ts = 100
    const handle = installTurnInterrupt({
      abortCurrentTurn: () => false,
      onIdleInterrupt: () => {
        idle = true
      },
      now: () => ts,
      target,
    })

    target.emit('SIGINT')
    ts = 500
    target.emit('SIGINT')
    expect(idle).toBe(true)
    handle.dispose()
  })

  test('readline SIGINT alone triggers abort (process not required)', () => {
    const rl = new EventEmitter() as EventEmitter & {
      on(event: 'SIGINT', listener: () => void): EventEmitter
      off(event: 'SIGINT', listener: () => void): EventEmitter
    }
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
      // 不往 process 挂；模拟仅 rl 收到 Ctrl+C
      target: new EventEmitter(),
      readline: rl,
    })

    rl.emit('SIGINT')
    expect(aborted).toBe(true)
    expect(idle).toBe(false)
    handle.dispose()
  })

  test('second SIGINT during active cleanup triggers force interrupt', () => {
    const target = new EventEmitter()
    let abortCalls = 0
    let inProgress = true
    let forced = false
    let idle = false

    const handle = installTurnInterrupt({
      abortCurrentTurn: () => {
        abortCalls += 1
        return abortCalls === 1
      },
      isTurnInProgress: () => inProgress,
      onForceInterrupt: () => {
        forced = true
      },
      onIdleInterrupt: () => {
        idle = true
      },
      target,
    })

    target.emit('SIGINT')
    target.emit('SIGINT')

    expect(forced).toBe(true)
    expect(idle).toBe(false)

    inProgress = false
    target.emit('SIGINT')
    expect(idle).toBe(false)
    target.emit('SIGINT')
    expect(idle).toBe(true)
    handle.dispose()
  })

  test('idle press after timeout becomes first press again', () => {
    const target = new EventEmitter()
    let idle = 0
    let ts = 100
    const handle = installTurnInterrupt({
      abortCurrentTurn: () => false,
      onIdleInterrupt: () => {
        idle += 1
      },
      now: () => ts,
      idleDoublePressWindowMs: 1000,
      target,
    })

    target.emit('SIGINT')
    ts = 1201
    target.emit('SIGINT')
    expect(idle).toBe(0)
    ts = 1800
    target.emit('SIGINT')
    expect(idle).toBe(1)
    handle.dispose()
  })
})
