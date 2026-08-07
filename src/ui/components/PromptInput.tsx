import React, { useState } from 'react'
import { Box, Text, useInput } from '@anthropic/ink'

export type PromptInputProps = {
  disabled?: boolean
  onSubmit: (value: string) => void
}

/**
 * Minimal CC-aligned PromptInput under `src/ui/components`.
 * Full CC PromptInput can replace this file later via upstream sync.
 */
export function PromptInput({ disabled, onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('')

  useInput(
    (input, key) => {
      if (disabled) return
      if (key.return) {
        const v = value
        setValue('')
        onSubmit(v)
        return
      }
      if (key.backspace || key.delete) {
        setValue(prev => prev.slice(0, -1))
        return
      }
      if (key.ctrl || key.meta) return
      if (input) setValue(prev => prev + input)
    },
    { isActive: !disabled },
  )

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={"cyan" as any}>{'> '}</Text>
        <Text>{value}</Text>
        <Text dimColor={!disabled}>█</Text>
      </Text>
    </Box>
  )
}
