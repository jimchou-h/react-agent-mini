/**
 * 将 interrupt（SIGINT 等）映射到当前 turn abort；空闲则退出回调。
 *
 * 状态机（对齐 v7-cancel / Claude Code）：
 * - running：abortCurrentTurn() 成功 → 首次 abort 本轮，进入 cleanup
 * - cleanup：已 abort 且 isTurnInProgress → 二次 interrupt → onForceInterrupt
 * - idle：无 turn；首次 onIdleFirstInterrupt（默认无动作）；
 *   窗口内二次 → onIdleInterrupt（通常退出）
 *
 * 注意：node:readline 占用 stdin 时，Ctrl+C 往往只触发 Interface 的 `SIGINT`
 *（无监听则 pause），不一定落到 process。必须同时挂 rl + process。
 */

export type TurnInterruptReadline = {
  on(event: 'SIGINT', listener: () => void): unknown
  off(event: 'SIGINT', listener: () => void): unknown
}

export type TurnInterruptOptions = {
  /** 尝试 abort 当前轮；返回 true 表示本次 SIGINT 已用于中断当前 turn */
  abortCurrentTurn: () => boolean
  /** 当前是否仍有 turn 在执行/收尾；用于判断二次 Ctrl+C 是否应强退 */
  isTurnInProgress?: () => boolean
  /** 空闲态第一次 Ctrl+C；默认无动作（对齐 CC idle 双击退出） */
  onIdleFirstInterrupt?: () => void
  /** 无进行中 turn 且在窗口内第二次 Ctrl+C 的行为（通常结束 REPL） */
  onIdleInterrupt: () => void
  /** 当前 turn 已经收到过一次 Ctrl+C，第二次时的行为（通常强退） */
  onForceInterrupt?: () => void
  /** idle 双击退出窗口，默认 1000ms */
  idleDoublePressWindowMs?: number
  now?: () => number
  /** 默认可监听 SIGINT 的目标（测试可注入 EventEmitter） */
  target?: NodeJS.EventEmitter
  event?: string
  /** readline Interface：Windows/REPL 下 Ctrl+C 的主通道 */
  readline?: TurnInterruptReadline
}

export type TurnInterruptHandle = {
  dispose: () => void
}

/**
 * 安装 interrupt 监听：有 turn → abort；无 turn → onIdleInterrupt。
 * 不在此调用 process.exit，由 onIdleInterrupt 决定如何结束。
 */
export function installTurnInterrupt(
  options: TurnInterruptOptions,
): TurnInterruptHandle {
  const target = options.target ?? process
  const event = options.event ?? 'SIGINT'
  const now = options.now ?? Date.now
  const idleWindowMs = options.idleDoublePressWindowMs ?? 1000
  let abortedActiveTurn = false
  let lastIdleInterruptAt = 0
  const handler = () => {
    if (options.abortCurrentTurn()) {
      abortedActiveTurn = true
      lastIdleInterruptAt = 0
      return
    }

    const stillRunning = options.isTurnInProgress?.() ?? false
    if (abortedActiveTurn && stillRunning) {
      options.onForceInterrupt?.()
      return
    }

    abortedActiveTurn = false
    const ts = now()
    if (
      lastIdleInterruptAt > 0 &&
      ts - lastIdleInterruptAt <= idleWindowMs
    ) {
      lastIdleInterruptAt = 0
      options.onIdleInterrupt()
      return
    }

    lastIdleInterruptAt = ts
    options.onIdleFirstInterrupt?.()
  }
  target.on(event, handler)
  options.readline?.on('SIGINT', handler)
  return {
    dispose: () => {
      target.off(event, handler)
      options.readline?.off('SIGINT', handler)
    },
  }
}
