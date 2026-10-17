import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, ActivityKind, ActivityTab, LineRange } from '../types'
import { analyze, describeDoc, describeFound, describeLines, mentionsOf, programsOf, roleOf } from './analyze'
import { aggregate, asHistory, describeProjectDoc, projectReportOf, storeKey, summarize, withSession } from './project'
import type { ProjectHistory } from './project'
import { reportOf } from './report'

const PANE = 'session-activity'
const MAX_ENTRIES = 500

const entries = atom({ plugin: 'session-activity', key: 'entries' } as const, [] as Activity[])
const tab = atom({ plugin: 'session-activity', key: 'tab' } as const, 'files' as ActivityTab)
const turnNo = atom({ plugin: 'session-activity', key: 'turn' } as const, 0)

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

const TABS: { id: ActivityTab; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'docs', label: 'Docs' },
  { id: 'project', label: 'Project' },
  { id: 'tools', label: 'Tools' },
]

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

type ReadText = { type?: string; file?: { startLine?: unknown; numLines?: unknown; totalLines?: unknown; content?: unknown } }

/** The lines a Read returned: from its result when it is text, else from its offset and limit. */
const linesOf = (input: Record<string, unknown>, result: unknown): LineRange | undefined => {
  const text = result as ReadText | undefined
  if (text?.type === 'text' && text.file !== undefined) {
    const start = num(text.file.startLine) ?? 1
    const count = num(text.file.numLines) ?? 0
    return { start, end: Math.max(start, start + count - 1), total: num(text.file.totalLines) }
  }
  const offset = num(input.offset)
  const limit = num(input.limit)
  if (offset === undefined && limit === undefined) return undefined
  const start = Math.max(1, offset ?? 1)
  return { start, end: limit === undefined ? start : start + limit - 1 }
}

/** Cuts the start off, so a path keeps its file name. */
const short = (text: string, max: number) =>
  text.length <= max ? text : '…' + text.slice(text.length - max + 1)

/** Cuts the end off, so a command reads from its start. */
const clip = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max - 1) + '…')

/** A Bash command on one line, without a leading `cd <dir> &&` that hides what it ran. */
const commandOf = (command: string) =>
  command
    .replace(/^\s*cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

const splitPath = (path: string) => {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? { dir: '', name: path } : { dir: path.slice(0, cut + 1), name: path.slice(cut + 1) }
}

const relativeTo = (cwd: string) => (path: string) =>
  cwd !== '' && path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path

const cwdOf = async ($: { session: { cwd: () => Promise<string> } }) => {
  try {
    return await $.session.cwd()
  } catch {
    return ''
  }
}


const sessionIdOf = async ($: { session: { id: () => Promise<string> } }) => {
  try {
    return await $.session.id()
  } catch {
    return 'session'
  }
}

/** This project's saved history with this session's live summary put in, unsaved. */
const historyOf = async (
  $: { store: { get: (key: string) => Promise<unknown> }; session: { id: () => Promise<string> } },
  list: Activity[],
  cwd: string,
): Promise<ProjectHistory> => {
  let saved: ProjectHistory | undefined
  try {
    saved = asHistory(await $.store.get(storeKey(cwd)))
  } catch {
    saved = undefined
  }
  if (list.length === 0) return saved ?? { sessions: {} }
  return withSession(saved, await sessionIdOf($), summarize(analyze(list), relativeTo(cwd), new Date().toISOString()))
}

/** Saves this session's summary under its project, so later sessions add to it. */
const save = async ($: EngineInterface) => {
  const list = await read($, entries)
  const cwd = await cwdOf($)
  if (list.length === 0 || cwd === '') return
  const history = await historyOf($, list, cwd)
  // The store holds 4 MiB in all: when a write is refused, drop this project's oldest session and try again.
  let sessions = Object.entries(history.sessions)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await $.store.set(storeKey(cwd), { sessions: Object.fromEntries(sessions) })
      return
    } catch (error) {
      if (sessions.length <= 1 || attempt === 3) throw error
      sessions = sessions.slice(1)
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'activity',
      description: 'Show the files, docs and tools Claude used this session in a pane',
    })
    await $.command.register({
      name: 'activity-report',
      description: "Hand Claude a report of what it read, to judge the codebase's docs and maps",
      argumentHint: '[project | reset]',
    })

    return next(e)
  })

  on('command.run', { command: 'activity' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Activity' })

    return { text: isPlaced ? 'Activity pane opened.' : 'No surface can draw the activity pane here.' }
  })

  on('command.run', { command: 'activity-report' }, async ($, e) => {
    const cwd = await cwdOf($)
    const arg = e.args.trim().toLowerCase()
    if (arg === 'reset') {
      await $.store.delete(storeKey(cwd))
      $.ui.invalidate('ui.render')
      return { text: `Cleared the saved reading history of ${cwd}. This session is saved again at the end of its next turn.` }
    }
    if (arg === 'project') {
      return { text: projectReportOf(aggregate(await historyOf($, await read($, entries), cwd)), cwd) }
    }

    return { text: reportOf(analyze(await read($, entries)), relativeTo(cwd)) }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await save($).catch(() => undefined)

    return done
  })

  on('session.end', async ($, e, next) => {
    await save($).catch(() => undefined)

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await update($, turnNo, n => n + 1)

    return next(e)
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
      turn: await read($, turnNo),
      ...(e.agentId === undefined ? {} : { agent: e.agentId }),
    }
    await update($, entries, list => [...list, entry].slice(-MAX_ENTRIES))

    const ran = await next(e)

    const isError = ran.deny !== undefined || ran.isError === true
    const isRead = entry.kind === 'read' && !isError
    const lines = isRead ? linesOf(input, ran.result) : undefined
    const content = (ran.result as ReadText | undefined)?.file?.content
    const mentions =
      isRead && roleOf(entry.target) === 'doc' && typeof content === 'string' ? mentionsOf(content) : undefined
    await update($, entries, list =>
      list.map(one => (one.id === entry.id ? { ...one, isDone: true, isError, lines, mentions } : one)),
    )

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, entries)
    const current = await read($, tab)
    const rel = relativeTo(await cwdOf($))
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 4)
    const width = Math.max(20, (e.props.bodyColumns ?? 60) - 4)

    const insights = analyze(list)
    const { files, docs, unmapped, turns } = insights
    const cwd = await cwdOf($)
    const project = current === 'project' && cwd !== '' ? aggregate(await historyOf($, list, cwd)) : undefined
    const counts: Record<ActivityTab, number | string> = {
      files: files.length,
      docs: docs.length,
      project: project?.sessions ?? '…',
      tools: list.length,
    }

    const tabs = (
      <Box>
        {TABS.map(t => (
          <Button
            key={`tab-${t.id}`}
            variant={current === t.id ? 'primary' : 'secondary'}
            onPress={() => update($, tab, () => t.id)}
          >
            {t.label} ({counts[t.id]})
          </Button>
        ))}
      </Box>
    )

    if (project !== undefined) {
      const docRows = project.docs.slice(0, Math.max(1, Math.floor((room - 8) / 3)))
      const dirRows = project.unmapped.slice(0, Math.max(1, Math.floor((room - 8) / 3)))
      const fileRows = project.files.slice(0, Math.max(1, room - 8 - docRows.length - dirRows.length))
      return (
        <Box flexDirection="column">
          {tabs}
          <Text>
            <Text bold>{project.sessions}</Text>
            <Text dimColor>
              {' '}session{project.sessions === 1 ? '' : 's'} in this project
              {project.since === undefined ? '' : ` since ${project.since.slice(0, 10)}`}
              {project.avgBefore === undefined ? '' : ` · ${project.avgBefore} calls before the first edit on average`}
            </Text>
          </Text>
          <Text bold>Docs</Text>
          {project.docs.length === 0 && <Text dimColor>   No doc was read with a tool.</Text>}
          {docRows.map(d => (
            <Text key={`pdoc-${d.path}`} color={d.ledSomewhere === 0 ? 'yellow' : undefined}>
              {'   '}
              <Text bold>{splitPath(d.path).name}</Text>
              <Text dimColor> {describeProjectDoc(d)}</Text>
            </Text>
          ))}
          <Text bold>Searched for, no doc points there</Text>
          {project.unmapped.length === 0 && <Text dimColor>   None yet.</Text>}
          {dirRows.map(d => (
            <Text key={`pdir-${d.dir}`}>
              {'   '}
              {short(d.dir || './', Math.max(10, width - 40))}
              <Text dimColor>
                {' '}in {d.sessions} session{d.sessions === 1 ? '' : 's'} · {d.searches} search{d.searches === 1 ? '' : 'es'} · {d.files} file{d.files === 1 ? '' : 's'}
              </Text>
            </Text>
          ))}
          <Text bold>Most read</Text>
          {fileRows.map(f => (
            <Text key={`pfile-${f.path}`}>
              {'   '}
              <Text bold>{f.reads}× </Text>
              {splitPath(f.path).name}
              <Text dimColor>
                {' '}in {f.sessions} session{f.sessions === 1 ? '' : 's'}
                {f.routed > 0 ? ` · via a doc ${f.routed}×` : ''}
                {' '}
                {short(splitPath(f.path).dir, Math.max(8, width - 40))}
              </Text>
            </Text>
          ))}
          <Text dimColor>/activity-report project hands this to Claude · reset clears it.</Text>
        </Box>
      )
    }

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          {tabs}
          <Text dimColor>Nothing used yet.</Text>
        </Box>
      )
    }

    if (current === 'docs') {
      const opened = files.filter(f => f.reads > 0)
      const routed = opened.filter(f => f.routedBy !== undefined).length
      const edited = turns.filter(t => t.hasEdit)
      const avg = edited.length === 0 ? 0 : Math.round(edited.reduce((s, t) => s + t.before, 0) / edited.length)
      const share = opened.length === 0 ? 0 : Math.round((routed / opened.length) * 100)
      const docRows = docs.slice(0, Math.max(1, Math.floor((room - 8) / 2)))
      const dirRows = unmapped.slice(0, Math.max(1, room - 8 - docRows.length * 2))

      return (
        <Box flexDirection="column">
          {tabs}
          <Text>
            <Text bold>{share}%</Text>
            <Text dimColor> of {opened.length} opened files were named by a doc read before · {insights.searches} searches</Text>
          </Text>
          {edited.length > 0 && (
            <Text>
              <Text bold>{avg}</Text>
              <Text dimColor>
                {' '}calls before the first edit, average of {edited.length} turn{edited.length === 1 ? '' : 's'} · last{' '}
                {edited.slice(-5).map(t => t.before).join(', ')}
              </Text>
            </Text>
          )}
          <Text bold>Docs read</Text>
          {docs.length === 0 && <Text dimColor>   No doc was read with a tool.</Text>}
          {docRows.map(doc => {
            const { dir, name } = splitPath(rel(doc.path))
            return (
              <Box key={`doc-${doc.path}`} flexDirection="column">
                <Text color={doc.routed.length === 0 ? 'yellow' : undefined}>
                  {'   '}
                  <Text bold>{name}</Text>
                  <Text dimColor> {short(dir, Math.max(8, width - name.length - 8))}</Text>
                </Text>
                <Text dimColor>
                  {'      '}
                  {doc.reads}× read · {describeDoc(doc)}
                  {doc.routed.length > 0 ? `: ${clip(doc.routed.map(p => splitPath(p).name).join(', '), Math.max(10, width - 30))}` : ''}
                </Text>
              </Box>
            )
          })}
          <Text bold>Found by searching, no doc points there</Text>
          {unmapped.length === 0 && <Text dimColor>   None yet.</Text>}
          {dirRows.map(d => (
            <Text key={`dir-${d.dir}`}>
              {'   '}
              {short(rel(d.dir) || './', Math.max(10, width - 30))}
              <Text dimColor>
                {' '}
                {d.files} file{d.files === 1 ? '' : 's'} · {d.searches} search{d.searches === 1 ? '' : 'es'}
              </Text>
            </Text>
          ))}
          <Text dimColor>/activity-report hands this to Claude to suggest doc changes.</Text>
        </Box>
      )
    }

    if (current === 'tools') {
      const bash = new Map<string, number>()
      let bashCalls = 0
      for (const one of list) {
        if (one.tool !== 'Bash') continue
        bashCalls += 1
        for (const p of new Set(programsOf(one.target))) bash.set(p, (bash.get(p) ?? 0) + 1)
      }
      const programs = [...bash.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      const toolRows = [...list].reverse().slice(0, Math.max(1, room - (bashCalls > 0 ? 2 : 0)))

      return (
        <Box flexDirection="column">
          {tabs}
          {bashCalls > 0 && (
            <Text>
              <Text bold>Bash ×{bashCalls}</Text>
              <Text dimColor>
                {' '}
                {programs.slice(0, 12).map(([name, n]) => `${name} ${n}`).join(' · ')}
                {programs.length > 12 ? ` · +${programs.length - 12} more` : ''}
              </Text>
            </Text>
          )}
          {toolRows.map(one => (
            <Text color={one.isError ? 'red' : undefined} dimColor={one.isDone && !one.isError}>
              {one.isError ? 'fail' : one.isDone ? 'done' : 'runs'} {one.tool}
              {one.tool === 'Bash' ? (
                <Text> {clip(commandOf(one.target), Math.max(10, width - 10))}</Text>
              ) : (
                <Text dimColor> {short(rel(one.target).replace(/\s+/g, ' '), Math.max(10, width - one.tool.length - 6))}</Text>
              )}
              {one.lines !== undefined && <Text dimColor> L{one.lines.start}–{one.lines.end}</Text>}
            </Text>
          ))}
        </Box>
      )
    }

    const fileRows = files.slice(0, Math.max(1, Math.floor((room - 1) / 2)))

    return (
      <Box flexDirection="column">
        {tabs}
        <Text dimColor>Most read first</Text>
        {fileRows.map(row => {
          const { dir, name } = splitPath(rel(row.path))
          const changes = [
            row.edits > 0 ? `edited ${row.edits}×` : '',
            row.writes > 0 ? `written ${row.writes}×` : '',
            row.errors > 0 ? `${row.errors} failed` : '',
          ]
          const detail = [describeLines(row), describeFound(row, rel), ...changes].filter(Boolean).join(' · ')
          return (
            <Box key={row.path} flexDirection="column">
              <Text color={row.errors > 0 ? 'red' : undefined}>
                <Text bold>{row.reads > 0 ? `${row.reads}× ` : '   '}</Text>
                <Text bold>{name}</Text>
                <Text dimColor> {row.role === 'code' ? '' : `${row.role} `}{short(dir, Math.max(8, width - name.length - 12))}</Text>
              </Text>
              <Text dimColor>
                {'   '}
                {detail || 'not read'}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
