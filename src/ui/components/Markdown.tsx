import React, { useMemo } from 'react'
import { Ansi, Box } from '@anthropic/ink'
import { formatMarkdown } from '../utils/markdownFormat.js'

export type MarkdownProps = {
  children: string
  /** When true, dim the rendered ANSI output */
  dimColor?: boolean
}

/**
 * CC-aligned Markdown under `src/ui/components`.
 * Uses marked + chalk ANSI (see `ui/utils/markdownFormat.ts`).
 * Replace with full CC Markdown.tsx via upstream sync when ready.
 */
export function Markdown({ children, dimColor }: MarkdownProps): React.ReactNode {
  const ansi = useMemo(() => formatMarkdown(children), [children])
  return (
    <Box flexDirection="column">
      <Ansi dimColor={dimColor}>{ansi}</Ansi>
    </Box>
  )
}
