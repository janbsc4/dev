import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Activity, ActivityKind, ActivityTab, LineRange } from '../types'

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

type FileRow = {
  path: string
  reads: number
  edits: number
  writes: number
  errors: number
  ranges: LineRange[]
  total?: number
  /** Index of the latest call on the file, to break ties by recency. */
  last: number
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

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/** The lines a Read returned: from its result when it is text, else from its offset and limit. */
const linesOf = (input: Record<string, unknown>, result: unknown): LineRange | undefined => {
  const file = (result as { type?: string; file?: Record<string, unknown> } | undefined)?.file
  if ((result as { type?: string } | undefined)?.type === 'text' && file !== undefined) {
    const start = num(file.startLine) ?? 1
    const count = num(file.numLines) ?? 0
    return { start, end: Math.max(start, start + count - 1), total: num(file.totalLines) }
  }
  const offset = num(input.offset)
  const limit = num(input.limit)
  if (offset === undefined && limit === undefined) return undefined
  const start = Math.max(1, offset ?? 1)
  return { start, end: limit === undefined ? start : start + limit - 1 }
}

const merge = (ranges: LineRange[]): LineRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: LineRange[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (prev !== undefined && r.start <= prev.end + 1) prev.end = Math.max(prev.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

const describeLines = (row: FileRow): string => {
  if (row.ranges.length === 0) return row.reads > 0 ? 'lines unknown' : ''
  const merged = merge(row.ranges)
  const spans = merged.map(r => (r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`)).join(', ')
  if (row.total === undefined || row.total === 0) return `lines ${spans}`
  const covered = merged.reduce((sum, r) => sum + Math.min(r.end, row.total!) - r.start + 1, 0)
  if (covered >= row.total) return `all ${row.total} lines`
  return `lines ${spans} of ${row.total} · ${Math.round((covered / row.total) * 100)}%`
}

const short = (text: string, max: number) =>
  text.length <= max ? text : '…' + text.slice(text.length - max + 1)

const splitPath = (path: string) => {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut + 1), name: path.slice(cut + 1) }
}

const filesOf = (list: Activity[]): FileRow[] => {
  const files = new Map<string, FileRow>()
  list.forEach((one, index) => {
    if (one.target === '' || !(one.kind === 'read' || one.kind === 'edit' || one.kind === 'write')) return
    const row = files.get(one.target) ?? {
      path: one.target, reads: 0, edits: 0, writes: 0, errors: 0, ranges: [], last: 0,
    }
    if (one.kind === 'read') row.reads += 1
    if (one.kind === 'edit') row.edits += 1
    if (one.kind === 'write') row.writes += 1
    if (one.isError) row.errors += 1
    if (one.lines !== undefined && !one.isError) {
      row.ranges.push(one.lines)
      if (one.lines.total !== undefined) row.total = one.lines.total
    }
    row.last = index
    files.set(one.target, row)
  })
  return [...files.values()].sort(
    (a, b) => b.reads - a.reads || b.edits + b.writes - (a.edits + a.writes) || b.last - a.last,
  )
}

/** Cuts the end off, so a command reads from its start. */
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1) + '…')

/** A Bash command on one line, without a leading `cd <dir> &&` that hides what it ran. */
const commandOf = (command: string) =>
  command
    .replace(/^\s*cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

const WRAPPERS = new Set(['sudo', 'time', 'env', 'command', 'exec', 'nohup', 'xargs'])

/** The programs a command line runs: the first word of each piece between pipes, `&&`, `||` and `;`. */
const programsOf = (command: string): string[] => {
  const plain = command
    .replace(/(<<-?\s*['"]?(\w+)['"]?[^\n]*)\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, '$1')
    .replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, 'Q')
  const out: string[] = []
  for (const piece of plain.split(/\|\||&&|[|;\n]|\$\(|`/)) {
    const words = piece.trim().replace(/^[({!]+\s*/, '').split(/\s+/)
    let i = 0
    while (i < words.length && (/^\w+=/.test(words[i]!) || WRAPPERS.has(words[i]!))) i += 1
    const word = words[i]
    if (word === undefined || word === '' || word === 'Q' || word === 'cd' || /^[$)}<>&\d]/.test(word)) continue
    out.push(word.slice(word.lastIndexOf('/') + 1))
  }
  return out
}

const bashCounts = (list: Activity[]) => {
  const counts = new Map<string, number>()
  let calls = 0
  for (const one of list) {
    if (one.tool !== 'Bash') continue
    calls += 1
    for (const program of new Set(programsOf(one.target))) counts.set(program, (counts.get(program) ?? 0) + 1)
  }
  return { calls, programs: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }
}

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
    const lines = entry.kind === 'read' && !isError ? linesOf(input, ran.result) : undefined
    await update($, entries, list =>
      list.map(one => (one.id === entry.id ? { ...one, isDone: true, isError, lines } : one)),
    )

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, entries)
    const current = await read($, tab)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 4)
    const width = Math.max(20, (e.props.bodyColumns ?? 60) - 4)

    const files = filesOf(list)
    const fileRows = files.slice(0, Math.max(1, Math.floor(room / 2)))
    const bash = bashCounts(list)
    const toolRows = [...list].reverse().slice(0, Math.max(1, room - (bash.calls > 0 ? 2 : 0)))

    return (
      <Box flexDirection="column">
        <Box>
          <Button
            key="tab-files"
            variant={current === 'files' ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => 'files' as ActivityTab)}
          >
            Files ({files.length})
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
        {current === 'files' && files.length > 0 && (
          <Text dimColor>Most read first</Text>
        )}
        {current === 'files' &&
          fileRows.map(row => {
            const { dir, name } = splitPath(row.path)
            const changes = [
              row.edits > 0 ? `edited ${row.edits}×` : '',
              row.writes > 0 ? `written ${row.writes}×` : '',
              row.errors > 0 ? `${row.errors} failed` : '',
            ].filter(Boolean).join(' · ')
            const lines = describeLines(row)
            return (
              <Box key={row.path} flexDirection="column">
                <Text color={row.errors > 0 ? 'red' : undefined}>
                  <Text bold>{row.reads > 0 ? `${row.reads}× ` : '   '}</Text>
                  <Text bold>{name}</Text>
                  <Text dimColor> {short(dir, Math.max(8, width - name.length - 6))}</Text>
                </Text>
                <Text dimColor>
                  {'   '}
                  {[lines, changes].filter(Boolean).join(' · ') || 'not read'}
                </Text>
              </Box>
            )
          })}
        {current === 'tools' && bash.calls > 0 && (
          <Text>
            <Text bold>Bash ×{bash.calls}</Text>
            <Text dimColor>
              {' '}
              {bash.programs.slice(0, 12).map(([name, n]) => `${name} ${n}`).join(' · ')}
              {bash.programs.length > 12 ? ` · +${bash.programs.length - 12} more` : ''}
            </Text>
          </Text>
        )}
        {current === 'tools' &&
          toolRows.map(one => (
            <Text color={one.isError ? 'red' : undefined} dimColor={one.isDone && !one.isError}>
              {one.isError ? 'fail' : one.isDone ? 'done' : 'runs'} {one.tool}
              {one.tool === 'Bash' ? (
                <Text> {clip(commandOf(one.target), Math.max(10, width - 10))}</Text>
              ) : (
                <Text dimColor> {short(one.target.replace(/\s+/g, ' '), Math.max(10, width - one.tool.length - 6))}</Text>
              )}
              {one.lines !== undefined && (
                <Text dimColor> L{one.lines.start}–{one.lines.end}</Text>
              )}
            </Text>
          ))}
      </Box>
    )
  })
}
