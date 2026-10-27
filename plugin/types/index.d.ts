export type BadgeState = {
  checkedAt: string | null
  openDebriefs: number
  openQuestions: number
}

declare module 'claude-code' {
  interface PluginState {
    'hion-debriefs': { badge: BadgeState | null; isHidden: boolean }
  }
}
