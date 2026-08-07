import type { ReactNode } from 'react'

export type RenderOptions = {
  stdout?: NodeJS.WriteStream
  stdin?: NodeJS.ReadStream
  stderr?: NodeJS.WriteStream
  exitOnCtrlC?: boolean
  patchConsole?: boolean
}

export type Root = {
  render: (node: ReactNode) => void
  unmount: () => void
  waitUntilExit: () => Promise<void>
}

export function createRoot(options?: RenderOptions): Promise<Root>
export function renderSync(
  node: ReactNode,
  options?: RenderOptions,
): {
  unmount: () => void
  waitUntilExit: () => Promise<void>
}

export type Key = {
  return?: boolean
  backspace?: boolean
  delete?: boolean
  ctrl?: boolean
  meta?: boolean
  [k: string]: unknown
}

export const Text: any
export const Box: any
export const Ansi: any
export const useInput: (
  handler: (input: string, key: Key) => void,
  options?: { isActive?: boolean },
) => void
export const useApp: () => { exit: (error?: Error) => void }

export default function render(
  node: ReactNode,
  options?: RenderOptions,
): Promise<{ unmount: () => void; waitUntilExit: () => Promise<void> }>
