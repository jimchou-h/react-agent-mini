import React from 'react'
import { Box, Text, useInput } from '@anthropic/ink'
import type { PermissionRequest } from '../../../host/types.js'

export type PermissionDialogProps = {
  request: PermissionRequest
  onAnswer: (answer: string) => void
}

/**
 * Fallback permission UI (CC permissions/ can replace with tool-specific dialogs).
 * Keys: y / n / a
 */
export function PermissionDialog({ request, onAnswer }: PermissionDialogProps) {
  useInput(input => {
    const ch = input.toLowerCase()
    if (ch === 'y' || ch === 'n' || ch === 'a') onAnswer(ch)
  })

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} marginY={1}>
      <Text bold color={"yellow" as any}>
        Permission: {request.toolName}
      </Text>
      <Text>{request.description}</Text>
      <Text dimColor>[y] allow once · [n] deny · [a] always allow (session)</Text>
    </Box>
  )
}
