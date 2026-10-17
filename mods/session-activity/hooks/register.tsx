import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Activity, ActivityKind, ActivityTab } from '../types'

const PANE = 'session-activity'
const MAX_ENTRIES = 500

const entries = atom({ plugin: 'session-activity', key: 'entries' } as const, [] as Activity[])
const tab = atom({ plugin: 'session-activity', key: 'tab' } as const, 'files' as ActivityTab)

const KINDS: Record<string, ActivityKind> = {
  Read: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
  Write: 'write',
  Bash: 'run',
  Grep: 'search',
  Glob: 'search',
  WebSearch: 'search',
  WebFetch: 'search',
}

const first = (input: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return ''
}

const targetOf = (input: Record<string, unknown>): string =>
  first(input, ['file_path', 'notebook_path', 'path', 'command', 'pattern', 'url', 'query'])

const isFileKind = (kind: ActivityKind) => kind === 'read' || kind === 'edit' || kind === 'write'

const short = (text: string, max: number) =>
  text.length <= max ? text : '…' + text.slice(text.length - max + 1)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'activity',
      description: 'Show the files and tools Claude used this session in a pane',
    })

    return next(e)
  })

  on('command.run', { command: 'activity' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Activity' })

    return { text: isPlaced ? 'Activity pane opened.' : 'No surface can draw the activity pane here.' }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const tool = String(e.tool)
    const entry: Activity = {
      id: e.tool_use_id,
      tool,
      kind: KINDS[tool] ?? 'other',
      target: targetOf(input),
      isDone: false,
      isError: false,
    }
    await update($, entries, list => [...list, entry].slice(-MAX_ENTRIES))

    const ran = await next(e)

    const isError = ran.deny !== undefined || ran.isError === true
    await update($, entries, list =>
      list.map(one => (one.id === entry.id ? { ...one, isDone: true, isError } : one)),
    )

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, entries)
    const current = await read($, tab)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 6)
    const width = Math.max(20, (e.props.bodyColumns ?? 60) - 14)

    const files = new Map<string, { read: number; edit: number; write: number; error: number }>()
    for (const one of list) {
      if (!isFileKind(one.kind) || one.target === '') continue
      const row = files.get(one.target) ?? { read: 0, edit: 0, write: 0, error: 0 }
      row[one.kind as 'read' | 'edit' | 'write'] += 1
      if (one.isError) row.error += 1
      files.set(one.target, row)
    }
    const fileRows = [...files.entries()].reverse().slice(0, room)
    const toolRows = [...list].reverse().slice(0, room)

    return (
      <Box flexDirection="column">
        <Box>
          <Button
            key="tab-files"
            variant={current === 'files' ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => 'files' as ActivityTab)}
          >
            Files ({files.size})
          </Button>
          <Text> </Text>
          <Button
            key="tab-tools"
            variant={current === 'tools' ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => 'tools' as ActivityTab)}
          >
            Tools ({list.length})
          </Button>
        </Box>
        {list.length === 0 && <Text dimColor>Nothing used yet.</Text>}
        {current === 'files' &&
          fileRows.map(([path, n]) => (
            <Text color={n.error > 0 ? 'red' : undefined}>
              {n.write > 0 ? 'W' : '·'}
              {n.edit > 0 ? 'E' : '·'}
              {n.read > 0 ? 'R' : '·'} {short(path, width)}
              <Text dimColor> ×{n.read + n.edit + n.write}</Text>
            </Text>
          ))}
        {current === 'tools' &&
          toolRows.map(one => (
            <Text color={one.isError ? 'red' : undefined} dimColor={one.isDone && !one.isError}>
              {one.isError ? 'fail' : one.isDone ? 'done' : 'runs'} {one.tool}
              <Text dimColor> {short(one.target.replace(/\s+/g, ' '), width)}</Text>
            </Text>
          ))}
      </Box>
    )
  })
}
