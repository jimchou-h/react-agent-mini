import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Box, Text, useApp, useInput } from '@anthropic/ink'
import type { HostBridge } from '../../host/HostBridge.js'
import type { HostBridgeSnapshot } from '../../host/types.js'
import {
  filterSlashSuggestions,
  listSlashSuggestions,
} from '../../host/slashSuggestions.js'
import { isHostFeatureEnabled, stubNotice } from '../../host/stubs.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { StatusLine } from '../components/StatusLine.js'
import { SlashSuggestList } from '../components/SlashSuggestList.js'
import { PermissionDialog } from '../components/permissions/FallbackPermissionRequest.js'
import {
  buildHelpText,
  isSlashLine,
  parseSlashCommand,
  formatMemoryStatus,
} from '../../entrypoints/repl.js'
import { createTurnInterruptHandler } from '../../entrypoints/turnInterrupt.js'
import type { DiscoveredSkill } from '../../skills/discover.js'
import type { McpSlashCommand } from '../../services/mcp/types.js'
import {
  formatCompactSuccessFeedback,
  formatContextUsage,
  estimateContextUsage,
} from '../../services/compact/contextUsage.js'
import type { SummarizeFn } from '../../services/compact/autoCompact.js'

export type REPLProps = {
  bridge: HostBridge
  mcpCommands?: readonly McpSlashCommand[]
  skills?: readonly DiscoveredSkill[]
  summarizeForCompact?: SummarizeFn
  onExit?: () => void
}

/**
 * CC-aligned REPL screen under `src/ui/screens`.
 * Trimmed host wiring via HostBridge; expand by re-copying from upstream.
 */
export function REPL({
  bridge,
  mcpCommands = [],
  skills = [],
  summarizeForCompact,
  onExit,
}: REPLProps) {
  const { exit } = useApp()
  const [snap, setSnap] = useState<HostBridgeSnapshot>(() => bridge.snapshot())
  const [draft, setDraft] = useState('')
  const [suggestIndex, setSuggestIndex] = useState(0)

  useEffect(() => bridge.subscribe(setSnap), [bridge])

  const allSuggestions = useMemo(
    () => listSlashSuggestions(mcpCommands, skills),
    [mcpCommands, skills],
  )
  const suggestions = useMemo(
    () => filterSlashSuggestions(draft, allSuggestions),
    [allSuggestions, draft],
  )

  const leave = useCallback(() => {
    onExit?.()
    exit()
  }, [exit, onExit])

  const onInterrupt = useMemo(
    () =>
      createTurnInterruptHandler({
        abortCurrentTurn: () => bridge.abortTurn(),
        isTurnInProgress: () => bridge.engine.isTurnInProgress,
        onIdleFirstInterrupt: () => {
          bridge.pushSystem('再按一次 Ctrl+C 退出')
        },
        onIdleInterrupt: leave,
        onForceInterrupt: leave,
      }),
    [bridge, leave],
  )

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onInterrupt()
    }
  })

  const handleSubmit = useCallback(
    async (raw: string) => {
      if (snap.permission) return
      setDraft('')
      setSuggestIndex(0)

      const trimmed = raw.trim()
      if (!trimmed) return

      if (trimmed === '/plan' || trimmed.startsWith('/plan ')) {
        if (!isHostFeatureEnabled('plan-mode')) {
          bridge.pushSystem(stubNotice('plan-mode'))
          return
        }
      }

      if (isSlashLine(trimmed)) {
        const slash = parseSlashCommand(trimmed)
        if (slash?.type === 'exit') {
          leave()
          return
        }
        if (slash?.type === 'clear') {
          bridge.engine.clear()
          bridge.clearTranscript()
          bridge.pushSystem('会话已清空')
          return
        }
        if (slash?.type === 'help') {
          bridge.pushSystem(buildHelpText(mcpCommands, skills))
          return
        }
        if (slash?.type === 'status') {
          const estimate = estimateContextUsage(bridge.engine.messages, {
            usage: bridge.engine.lastUsage ?? null,
          })
          bridge.pushSystem(formatContextUsage(estimate))
          return
        }
        if (slash?.type === 'memory') {
          await bridge.engine.refreshMemoryIfNeeded()
          bridge.pushSystem(formatMemoryStatus(bridge.engine.memorySnapshot))
          return
        }
        if (slash?.type === 'compact') {
          if (!summarizeForCompact) {
            bridge.pushSystem('压缩失败: 未配置摘要函数（summarizeForCompact）')
            return
          }
          try {
            const result = await bridge.engine.compactNow({
              summarize: summarizeForCompact,
            })
            const feedback = formatCompactSuccessFeedback(
              result.before,
              result.after,
            )
            bridge.pushSystem(
              feedback ??
                `会话已整理（占用未变：${formatContextUsage(result.after)}）`,
            )
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            bridge.pushSystem(`压缩失败: ${msg}`)
          }
          return
        }
        if (!slash) {
          bridge.pushSystem(`未知命令: ${trimmed}`)
          return
        }
        return
      }

      await bridge.submitUserText(trimmed)
    },
    [bridge, leave, mcpCommands, skills, snap.permission, summarizeForCompact],
  )

  return (
    <Box flexDirection="column" width="100%">
      <Text bold>react-agent-mini</Text>
      <Messages snapshot={snap} />
      <StatusLine snapshot={snap} />
      {snap.permission ? (
        <PermissionDialog
          request={snap.permission}
          onAnswer={a => bridge.answerPermission(a)}
        />
      ) : (
        <Box flexDirection="column">
          <SlashSuggestList
            suggestions={suggestions}
            selectedIndex={suggestIndex}
          />
          <PromptInput
            disabled={snap.turnInProgress}
            onChange={setDraft}
            onSubmit={v => {
              if (suggestions.length > 0 && v.trim() === suggestions[suggestIndex]?.command.slice(0, v.trim().length)) {
                // Tab-like: if user hits enter on partial match with selection, use selected
              }
              void handleSubmit(v)
            }}
          />
        </Box>
      )}
    </Box>
  )
}
