export type ActivityKind = 'read' | 'edit' | 'write' | 'run' | 'search' | 'other'
export type ActivityTab = 'files' | 'tools'
export type Activity = {
  id: string
  tool: string
  kind: ActivityKind
  /** File path, command, pattern or URL the call was about. */
  target: string
  isDone: boolean
  isError: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-activity': { entries: Activity[]; tab: ActivityTab }
  }
}
