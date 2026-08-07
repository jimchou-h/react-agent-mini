/** Stubs for CC UI capabilities this host does not implement yet. */
export function isHostFeatureEnabled(name: string): boolean {
  const disabled = new Set([
    'plan-mode',
    'ask-user-question',
    'sandbox',
    'vim-input',
    'alternate-screen',
  ])
  return !disabled.has(name)
}

export function stubNotice(feature: string): string {
  return `（未启用）${feature} — 见 docs/ui-upstream.md`
}
