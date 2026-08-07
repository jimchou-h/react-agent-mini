import React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { SlashSuggestion } from '../../host/slashSuggestions.js'

export type SlashSuggestProps = {
  suggestions: readonly SlashSuggestion[]
  selectedIndex?: number
}

export function SlashSuggestList({
  suggestions,
  selectedIndex = 0,
}: SlashSuggestProps) {
  if (suggestions.length === 0) return null
  return (
    <Box flexDirection="column" marginBottom={1}>
      {suggestions.map((s, i) => (
        <Text key={s.command} dimColor={i !== selectedIndex}>
          {i === selectedIndex ? '> ' : '  '}
          {s.command}
          {s.description ? ` — ${s.description}` : ''}
          <Text dimColor> ({s.source})</Text>
        </Text>
      ))}
    </Box>
  )
}
