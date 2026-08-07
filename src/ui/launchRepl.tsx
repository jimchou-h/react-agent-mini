import React from 'react'
import { createRoot } from '@anthropic/ink'
import type { HostBridge } from '../host/HostBridge.js'
import type { DiscoveredSkill } from '../skills/discover.js'
import type { McpSlashCommand } from '../services/mcp/types.js'
import type { SummarizeFn } from '../services/compact/autoCompact.js'
import { REPL } from './screens/REPL.js'

export type LaunchReplOptions = {
  bridge: HostBridge
  mcpCommands?: readonly McpSlashCommand[]
  skills?: readonly DiscoveredSkill[]
  summarizeForCompact?: SummarizeFn
}

/**
 * CC-style launchRepl: create Ink root and mount REPL screen.
 */
export async function launchRepl(options: LaunchReplOptions): Promise<void> {
  const root = await createRoot({
    exitOnCtrlC: false,
    patchConsole: true,
  })

  await new Promise<void>(resolve => {
    root.render(
      <REPL
        bridge={options.bridge}
        mcpCommands={options.mcpCommands}
        skills={options.skills}
        summarizeForCompact={options.summarizeForCompact}
        onExit={() => {
          root.unmount()
          resolve()
        }}
      />,
    )
    void root.waitUntilExit().then(() => resolve())
  })
}
