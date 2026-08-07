import React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { HostBridgeSnapshot, TranscriptItem } from '../../host/types.js'

function ItemView({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <Box>
          <Text color={"green" as any}>you: </Text>
          <Text>{item.text}</Text>
        </Box>
      )
    case 'assistant':
      return (
        <Box>
          <Text color={"magenta" as any}>assistant: </Text>
          <Text>{item.text}</Text>
        </Box>
      )
    case 'tool':
      return (
        <Box>
          <Text color={"yellow" as any}>
            [{item.status}] {item.toolName}
            {item.summary ? `: ${item.summary}` : ''}
          </Text>
        </Box>
      )
    case 'system':
      return (
        <Box>
          <Text dimColor>{item.text}</Text>
        </Box>
      )
  }
}

export type MessagesProps = {
  snapshot: HostBridgeSnapshot
}

/** CC-aligned Messages list (trimmed). */
export function Messages({ snapshot }: MessagesProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {snapshot.items.map(item => (
        <ItemView key={item.id} item={item} />
      ))}
      {snapshot.streamingText ? (
        <Box>
          <Text color={"magenta" as any}>assistant: </Text>
          <Text>{snapshot.streamingText}</Text>
        </Box>
      ) : null}
    </Box>
  )
}
