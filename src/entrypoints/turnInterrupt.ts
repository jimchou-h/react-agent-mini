/**
 * 将 interrupt（SIGINT 等）映射到当前 turn abort；空闲则退出回调。
 *
 * 注意：node:readline 占用 stdin 时，Ctrl+C 往往只触发 Interface 的 `SIGINT`
 *（无监听则 pause），不一定落到 process。必须同时挂 rl + process。
 */

export type TurnInterruptReadline = {
  on(event: 'SIGINT', listener: () => void): unknown
  off(event: 'SIGINT', listener: () => void): unknown
}

export type TurnInterruptOptions = {
  /** 尝试 abort 当前轮；返回 true 表示已处理（有进行中 turn 或正在收尾） */
  abortCurrentTurn: () => boolean
  /** 无进行中 turn 时的行为（通常结束 REPL） */
  onIdleInterrupt: () => void
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
  const handler = () => {
    if (!options.abortCurrentTurn()) {
      options.onIdleInterrupt()
    }
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
