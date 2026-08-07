import React, { useState } from 'react'
import { Box, Text, useInput } from '@anthropic/ink'

export type PromptInputProps = {
  disabled?: boolean
  onSubmit: (value: string) => void
  onChange?: (value: string) => void
}

/**
 * Minimal CC-aligned PromptInput under `src/ui/components`.
 * Full CC PromptInput can replace this file later via upstream sync.
 */
export function PromptInput({ disabled, onSubmit, onChange }: PromptInputProps) {
  const [value, setValue] = useState('')

  const update = (next: string) => {
    setValue(next)
    onChange?.(next)
  }

  useInput(
    (input, key) => {
      if (disabled) return
      if (key.return) {
        const v = value
        update('')
        onSubmit(v)
        return
      }
      if (key.backspace || key.delete) {
        update(value.slice(0, -1))
        return
      }
      if (key.ctrl || key.meta) return
      if (input) update(value + input)
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
