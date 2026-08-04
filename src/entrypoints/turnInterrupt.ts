/**
 * 将 interrupt（SIGINT 等）映射到当前 turn abort；空闲则退出回调。
 */

export type TurnInterruptOptions = {
  /** 尝试 abort 当前轮；返回 true 表示已处理（有进行中 turn） */
  abortCurrentTurn: () => boolean
  /** 无进行中 turn 时的行为（通常结束 REPL） */
  onIdleInterrupt: () => void
  /** 默认可监听 SIGINT 的目标（测试可注入 EventEmitter） */
  target?: NodeJS.EventEmitter
  event?: string
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
  return {
    dispose: () => {
      target.off(event, handler)
    },
  }
}
