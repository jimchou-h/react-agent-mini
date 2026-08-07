import React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { HostBridgeSnapshot, TranscriptItem } from '../../host/types.js'
import { Markdown } from './Markdown.js'

function ItemView({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case 'user':
      return (
        <Box flexDirection="column">
          <Text color={'green' as any}>you:</Text>
          <Markdown>{item.text}</Markdown>
        </Box>
      )
    case 'assistant':
      return (
        <Box flexDirection="column">
          <Text color={'magenta' as any}>assistant:</Text>
          <Markdown>{item.text}</Markdown>
        </Box>
      )
    case 'tool':
      return (
        <Box>
          <Text color={'yellow' as any}>
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
        <Box flexDirection="column">
          <Text color={'magenta' as any}>assistant:</Text>
          <Markdown>{snapshot.streamingText}</Markdown>
        </Box>
      ) : null}
    </Box>
  )
}
