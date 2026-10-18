import { atom, read, update } from 'claude-code'
import type { Color, EngineInterface, Register } from 'claude-code'

import type { Activity, ActivityKind, ActivityTab, LineRange } from '../types'
import { analyze, describeDoc, describeFound, describeLines, mentionsOf, programsOf, roleOf } from './analyze'
import { aggregate, asHistory, describeProjectDoc, projectReportOf, storeKey, summarize, withSession } from './project'
import type { ProjectHistory } from './project'
import { reportArgsOf, reportOf } from './report'

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

/** `1 file`, `2 files`. */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

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
      // Opening the pane reads nothing of the turn, so it runs at once mid-turn instead of waiting for the turn to end.
      immediate: true,
    })
    await $.command.register({
      name: 'activity-report',
      description: "Hand Claude a report of what it read, to judge the codebase's docs and maps; text after it is what Claude does with it",
      argumentHint: '[project | reset] [what to do with it]',
    })

    return next(e)
  })

  on('command.run', { command: 'activity' }, async $ => {
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Activity' })

    return { text: isPlaced ? 'Activity pane opened.' : 'No surface can draw the activity pane here.' }
  })

  on('command.run', { command: 'activity-report' }, async ($, e) => {
    const cwd = await cwdOf($)
    const { mode, ask } = reportArgsOf(e.args)
    if (mode === 'reset') {
      await $.store.delete(storeKey(cwd))
      $.ui.invalidate('ui.render')
      return { text: `Cleared the saved reading history of ${cwd}. This session is saved again at the end of its next turn.` }
    }
    const report =
      mode === 'project'
        ? projectReportOf(aggregate(await historyOf($, await read($, entries), cwd)), cwd)
        : reportOf(analyze(await read($, entries)), relativeTo(cwd))
    // A command's output starts no turn, and a command.run hook may not submit one: the engine would wait on the turn this
    // hook holds. So what the person asked after the command is sent as their own prompt once the command is done.
    if (ask !== '') $.clock.after(0, () => $.prompt.submit({ text: ask, asUser: true }))

    return { text: report }
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
    const cwd = await cwdOf($)
    const rel = relativeTo(cwd)
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 4)

    const insights = analyze(list)
    const { files, docs, unmapped, turns } = insights
    const project = current === 'project' && cwd !== '' ? aggregate(await historyOf($, list, cwd)) : undefined
    const counts: Record<ActivityTab, number | string> = {
      files: files.length,
      docs: docs.length,
      project: project?.sessions ?? '…',
      tools: list.length,
    }

    /** A big number over a caption; a row of them heads each tab. */
    const Stat = ({ value, label }: { value: number | string; label: string }) => (
      <Box flexDirection="column">
        <Text size="heading" weight="semibold" tabular>
          {String(value)}
        </Text>
        <Text size="caption" dimColor>
          {label}
        </Text>
      </Box>
    )
    const Stats = ({ children }: { children?: JSX.Children }) => (
      <Box flexDirection="row" flexWrap="wrap" columnGap="xl" rowGap="sm">
        {children}
      </Box>
    )
    const Section = ({ title, aside, children }: { title: string; aside?: string; children?: JSX.Children }) => (
      <Box flexDirection="column" gap="xs">
        <Box flexDirection="row" justifyContent="space-between" gap="sm">
          <Text size="footnote" weight="semibold" dimColor>
            {title.toUpperCase()}
          </Text>
          {aside !== undefined && (
            <Text size="caption" dimColor>
              {aside}
            </Text>
          )}
        </Box>
        {children}
      </Box>
    )
    const Empty = ({ children }: { children?: JSX.Children }) => (
      <Text size="footnote" dimColor italic>
        {children}
      </Text>
    )
    /** One file, doc or folder: its name and folder, a count on the right, a line of detail under it. */
    const Row = (row: { name: string; dir?: string; tag?: string; mark?: Color; color?: Color; metric?: string; detail?: string }) => (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" gap="sm">
          <Box flexDirection="row" gap="xs" flexShrink={1}>
            {row.mark !== undefined && <Text color={row.mark}>●</Text>}
            <Text weight="medium" color={row.color} wrap="truncate-start">
              {row.name}
            </Text>
            {row.tag !== undefined && (
              <Text size="caption" color="suggestion">
                {row.tag}
              </Text>
            )}
            {row.dir !== undefined && row.dir !== '' && (
              <Text size="footnote" dimColor wrap="truncate-start">
                {row.dir}
              </Text>
            )}
          </Box>
          {row.metric !== undefined && row.metric !== '' && (
            <Text dimColor tabular>
              {row.metric}
            </Text>
          )}
        </Box>
        {row.detail !== undefined && row.detail !== '' && (
          <Text size="footnote" dimColor>
            {row.detail}
          </Text>
        )}
      </Box>
    )
    const Hint = ({ command, text }: { command: string; text: string }) => (
      <Text size="caption" dimColor>
        <Text mono>{command}</Text> {text}
      </Text>
    )

    const tabs = (
      <Box flexDirection="row" gap="xs" flexWrap="wrap">
        {TABS.map(t => {
          const isActive = current === t.id
          return (
            <Button
              key={`tab-${t.id}`}
              variant={isActive ? 'primary' : 'secondary'}
              onPress={() => update($, tab, () => t.id)}
            >
              {t.label}{' '}
              <Text dimColor={!isActive} tabular>
                {String(counts[t.id])}
              </Text>
            </Button>
          )
        })}
      </Box>
    )
    const Page = ({ children }: { children?: JSX.Children }) => (
      <Box flexDirection="column" gap="md">
        {tabs}
        {children}
      </Box>
    )

    if (project !== undefined) {
      const share = Math.max(1, Math.floor((room - 12) / 6))
      const docRows = project.docs.slice(0, share)
      const dirRows = project.unmapped.slice(0, share)
      const fileRows = project.files.slice(0, Math.max(1, Math.floor((room - 12) / 2) - docRows.length - dirRows.length))
      return (
        <Page>
          <Stats>
            <Stat value={project.sessions} label={project.sessions === 1 ? 'session' : 'sessions'} />
            {project.since !== undefined && <Stat value={project.since.slice(0, 10)} label="first recorded" />}
            {project.avgBefore !== undefined && <Stat value={project.avgBefore} label="calls before first edit" />}
            <Stat value={project.searches} label={project.searches === 1 ? 'search' : 'searches'} />
          </Stats>
          <Section title="Docs" aside="read with a tool">
            {project.docs.length === 0 && <Empty>No doc was read with a tool.</Empty>}
            {docRows.map(d => (
              <Row
                name={splitPath(d.path).name}
                dir={splitPath(d.path).dir}
                mark={d.ledSomewhere === 0 ? 'warning' : 'success'}
                metric={`${d.reads}×`}
                detail={describeProjectDoc(d)}
              />
            ))}
          </Section>
          <Section title="Unmapped folders" aside="searched for, no doc points there">
            {project.unmapped.length === 0 && <Empty>None yet.</Empty>}
            {dirRows.map(d => (
              <Row
                name={d.dir || './'}
                metric={plural(d.searches, 'search', 'searches')}
                detail={`in ${plural(d.sessions, 'session')} · ${plural(d.files, 'file')}`}
              />
            ))}
          </Section>
          <Section title="Most read">
            {fileRows.map(f => (
              <Row
                name={splitPath(f.path).name}
                dir={splitPath(f.path).dir}
                metric={`${f.reads}×`}
                detail={`in ${plural(f.sessions, 'session')}${f.routed > 0 ? ` · via a doc ${f.routed}×` : ''}`}
              />
            ))}
          </Section>
          <Hint command="/activity-report project" text="hands this to Claude · reset clears it" />
        </Page>
      )
    }

    if (list.length === 0) {
      return (
        <Page>
          <Empty>Nothing used yet. Files, docs and tools show up here as Claude works.</Empty>
        </Page>
      )
    }

    if (current === 'docs') {
      const opened = files.filter(f => f.reads > 0)
      const routed = opened.filter(f => f.routedBy !== undefined).length
      const edited = turns.filter(t => t.hasEdit)
      const avg = edited.length === 0 ? 0 : Math.round(edited.reduce((s, t) => s + t.before, 0) / edited.length)
      const share = opened.length === 0 ? 0 : Math.round((routed / opened.length) * 100)
      const docRows = docs.slice(0, Math.max(1, Math.floor((room - 12) / 4)))
      const dirRows = unmapped.slice(0, Math.max(1, Math.floor((room - 12) / 2) - docRows.length))

      return (
        <Page>
          <Stats>
            <Stat value={`${share}%`} label={`of ${plural(opened.length, 'opened file')} named by a doc`} />
            {edited.length > 0 && (
              <Stat value={avg} label={`calls before first edit · last ${edited.slice(-5).map(t => t.before).join(', ')}`} />
            )}
            <Stat value={insights.searches} label={insights.searches === 1 ? 'search' : 'searches'} />
          </Stats>
          <Section title="Docs read">
            {docs.length === 0 && <Empty>No doc was read with a tool.</Empty>}
            {docRows.map(doc => {
              const { dir, name } = splitPath(rel(doc.path))
              const led = doc.routed.length > 0 ? `: ${doc.routed.map(p => splitPath(p).name).join(', ')}` : ''
              return (
                <Row
                  name={name}
                  dir={dir}
                  mark={doc.routed.length === 0 ? 'warning' : 'success'}
                  metric={`${doc.reads}×`}
                  detail={describeDoc(doc) + led}
                />
              )
            })}
          </Section>
          <Section title="Unmapped folders" aside="found by searching, no doc points there">
            {unmapped.length === 0 && <Empty>None yet.</Empty>}
            {dirRows.map(d => (
              <Row
                name={rel(d.dir) || './'}
                detail={`${plural(d.files, 'file')} · ${plural(d.searches, 'search', 'searches')}`}
              />
            ))}
          </Section>
          <Hint command="/activity-report" text="hands this to Claude to suggest doc changes" />
        </Page>
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
      const failed = list.filter(one => one.isError).length
      const running = list.filter(one => !one.isDone).length
      const toolRows = [...list].reverse().slice(0, Math.max(1, room - (bashCalls > 0 ? 9 : 6)))

      return (
        <Page>
          <Stats>
            <Stat value={list.length} label={list.length === 1 ? 'call' : 'calls'} />
            {running > 0 && <Stat value={running} label="running" />}
            <Stat value={failed} label="failed" />
          </Stats>
          {bashCalls > 0 && (
            <Section title="Bash" aside={plural(bashCalls, 'call')}>
              <Box flexDirection="row" flexWrap="wrap" columnGap="md">
                {programs.slice(0, 16).map(([name, n]) => (
                  <Text>
                    <Text mono>{name}</Text> <Text dimColor tabular>{String(n)}</Text>
                  </Text>
                ))}
                {programs.length > 16 && <Text dimColor>+{String(programs.length - 16)} more</Text>}
              </Box>
            </Section>
          )}
          <Section title="Calls" aside="newest first">
            {toolRows.map(one => (
              <Box flexDirection="row" gap="sm">
                <Text color={one.isError ? 'error' : one.isDone ? 'success' : 'warning'}>
                  {one.isError ? '✗' : one.isDone ? '✓' : '…'}
                </Text>
                <Text weight="medium" color={one.isError ? 'error' : undefined}>
                  {one.tool}
                </Text>
                <Box flexShrink={1}>
                  {one.tool === 'Bash' ? (
                    <Text mono size="footnote" wrap="truncate-end">
                      {commandOf(one.target)}
                    </Text>
                  ) : (
                    <Text size="footnote" dimColor wrap="truncate-start">
                      {rel(one.target).replace(/\s+/g, ' ')}
                    </Text>
                  )}
                </Box>
                {one.lines !== undefined && (
                  <Text size="footnote" dimColor tabular>
                    L{one.lines.start}–{one.lines.end}
                  </Text>
                )}
              </Box>
            ))}
          </Section>
        </Page>
      )
    }

    const fileRows = files.slice(0, Math.max(1, Math.floor((room - 5) / 2)))
    const reads = files.reduce((sum, f) => sum + f.reads, 0)
    const changed = files.filter(f => f.edits + f.writes > 0).length

    return (
      <Page>
        <Stats>
          <Stat value={files.length} label={files.length === 1 ? 'file' : 'files'} />
          <Stat value={reads} label={reads === 1 ? 'read' : 'reads'} />
          <Stat value={changed} label="changed" />
        </Stats>
        <Section title="Files" aside="most read first">
          {fileRows.map(row => {
            const { dir, name } = splitPath(rel(row.path))
            const changes = [
              row.edits > 0 ? `edited ${row.edits}×` : '',
              row.writes > 0 ? `written ${row.writes}×` : '',
              row.errors > 0 ? `${row.errors} failed` : '',
            ]
            const detail = [describeLines(row), describeFound(row, rel), ...changes].filter(Boolean).join(' · ')
            return (
              <Row
                name={name}
                dir={dir}
                tag={row.role === 'code' ? undefined : row.role}
                color={row.errors > 0 ? 'error' : undefined}
                metric={row.reads > 0 ? `${row.reads}×` : ''}
                detail={detail || 'not read'}
              />
            )
          })}
        </Section>
      </Page>
    )
  })
}
