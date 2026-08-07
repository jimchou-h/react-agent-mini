import React, { useEffect, useState, useCallback } from 'react'
import { Box, Text, useApp, useInput } from '@anthropic/ink'
import type { HostBridge } from '../../host/HostBridge.js'
import type { HostBridgeSnapshot } from '../../host/types.js'
import { Messages } from '../components/Messages.js'
import { PromptInput } from '../components/PromptInput.js'
import { StatusLine } from '../components/StatusLine.js'
import { PermissionDialog } from '../components/permissions/FallbackPermissionRequest.js'
import {
  buildHelpText,
  isSlashLine,
  parseSlashCommand,
  formatMemoryStatus,
} from '../../entrypoints/repl.js'
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

  useEffect(() => bridge.subscribe(setSnap), [bridge])

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (bridge.engine.isTurnInProgress) {
        bridge.abortTurn()
        return
      }
      // idle: exit (full three-phase interrupt lands in #118)
      onExit?.()
      exit()
    }
  })

  const handleSubmit = useCallback(
    async (raw: string) => {
      if (snap.permission) return

      const trimmed = raw.trim()
      if (!trimmed) return

      if (isSlashLine(trimmed)) {
        const slash = parseSlashCommand(trimmed)
        if (slash?.type === 'exit') {
          onExit?.()
          exit()
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
        // Unknown / MCP / Skill slash: notice for now (#117 expands suggestions)
        if (!slash) {
          bridge.pushSystem(`未知命令: ${trimmed}`)
          return
        }
        return
      }

      await bridge.submitUserText(trimmed)
    },
    [bridge, exit, mcpCommands, onExit, skills, snap.permission, summarizeForCompact],
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
        <PromptInput
          disabled={snap.turnInProgress}
          onSubmit={v => {
            void handleSubmit(v)
          }}
        />
      )}
    </Box>
  )
}
