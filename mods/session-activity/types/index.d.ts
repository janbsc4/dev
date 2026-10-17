export type ActivityKind = 'read' | 'edit' | 'write' | 'run' | 'search' | 'other'
export type ActivityTab = 'files' | 'tools'
/** Lines a Read returned, 1-based and inclusive; `total` is the file's length when known. */
export type LineRange = { start: number; end: number; total?: number }
export type Activity = {
  id: string
  tool: string
  kind: ActivityKind
  /** File path, command, pattern or URL the call was about. */
  target: string
  isDone: boolean
  isError: boolean
  lines?: LineRange
}

declare module 'claude-code' {
  interface PluginState {
    'session-activity': { entries: Activity[]; tab: ActivityTab }
  }
}
