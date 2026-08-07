import React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { HostBridgeSnapshot } from '../../host/types.js'

export type StatusLineProps = {
  snapshot: HostBridgeSnapshot
}

export function StatusLine({ snapshot }: StatusLineProps) {
  const parts: string[] = []
  if (snapshot.turnInProgress || snapshot.statusLine) {
    parts.push(snapshot.statusLine || 'running…')
  }
  if (snapshot.ctxPercent) parts.push(snapshot.ctxPercent)
  if (parts.length === 0) return null
  return (
    <Box>
      <Text dimColor>{parts.join(' · ')}</Text>
    </Box>
  )
}
