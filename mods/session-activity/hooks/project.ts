import type { Insights, Role } from './analyze'
import { dirOf } from './analyze'

/** How many sessions a project keeps; the oldest drop off first. */
export const MAX_SESSIONS = 40
const MAX_FILES = 300

/**
 * One session's reading, kept in `$.store` per project: replaced whole on each save, so saving after
 * every turn and again at the session's end never counts anything twice.
 */
export type SessionSummary = {
  /** When it was last saved, ISO. */
  at: string
  searches: number
  /** Turns with an edit, and the calls made before the first edit in them all. */
  edited: number
  before: number
  /** `[path, role, reads, searchesBefore, routedBy]`, paths relative to the project. */
  files: [string, Role, number, number, string][]
  /** `[path, reads, mentions, files it led to]`. */
  docs: [string, number, number, string[]][]
}

export type ProjectHistory = { sessions: Record<string, SessionSummary> }

export const storeKey = (cwd: string) => `project:${cwd}`

export const summarize = (insights: Insights, rel: (p: string) => string, at: string): SessionSummary => {
  const edited = insights.turns.filter(t => t.hasEdit)
  return {
    at,
    searches: insights.searches,
    edited: edited.length,
    before: edited.reduce((s, t) => s + t.before, 0),
    files: insights.files
      .filter(f => f.reads > 0)
      .slice(0, MAX_FILES)
      .map(f => [rel(f.path), f.role, f.reads, f.searchesBefore, f.routedBy === undefined ? '' : rel(f.routedBy)]),
    docs: insights.docs.map(d => [rel(d.path), d.reads, d.mentions, d.routed.map(rel)]),
  }
}

/** The history with this session's summary put in, oldest sessions dropped past the cap. */
export const withSession = (history: ProjectHistory | undefined, id: string, summary: SessionSummary): ProjectHistory => {
  const sessions = { ...(history?.sessions ?? {}), [id]: summary }
  const kept = Object.entries(sessions)
    .sort((a, b) => a[1].at.localeCompare(b[1].at))
    .slice(-MAX_SESSIONS)
  return { sessions: Object.fromEntries(kept) }
}

export const asHistory = (value: unknown): ProjectHistory | undefined =>
  typeof value === 'object' && value !== null && typeof (value as ProjectHistory).sessions === 'object'
    ? (value as ProjectHistory)
    : undefined

export type ProjectFile = { path: string; role: Role; reads: number; sessions: number; searches: number; routed: number }
export type ProjectDoc = { path: string; reads: number; sessions: number; ledSomewhere: number; ledTo: string[]; mentions: number }
export type ProjectFolder = { dir: string; sessions: number; searches: number; files: number }

export type ProjectInsights = {
  sessions: number
  since?: string
  searches: number
  /** Average calls before the first edit, over every turn with an edit. */
  avgBefore?: number
  files: ProjectFile[]
  docs: ProjectDoc[]
  /** Folders found by searching, with no doc read before pointing there, by how often that happened. */
  unmapped: ProjectFolder[]
}

export const aggregate = (history: ProjectHistory): ProjectInsights => {
  const summaries = Object.values(history.sessions)
  const files = new Map<string, ProjectFile>()
  const docs = new Map<string, ProjectDoc & { led: Set<string> }>()
  const folders = new Map<string, ProjectFolder & { seen: Set<string> }>()
  let searches = 0
  let edited = 0
  let before = 0

  for (const s of summaries) {
    searches += s.searches
    edited += s.edited
    before += s.before
    const dirsHere = new Set<string>()
    for (const [path, role, reads, searchesBefore, routedBy] of s.files) {
      const f = files.get(path) ?? { path, role, reads: 0, sessions: 0, searches: 0, routed: 0 }
      f.reads += reads
      f.sessions += 1
      f.searches += searchesBefore
      if (routedBy !== '') f.routed += 1
      files.set(path, f)
      if (role === 'doc' || routedBy !== '') continue
      const dir = dirOf(path)
      const d = folders.get(dir) ?? { dir, sessions: 0, searches: 0, files: 0, seen: new Set<string>() }
      d.searches += searchesBefore
      if (!d.seen.has(path)) {
        d.seen.add(path)
        d.files += 1
      }
      if (!dirsHere.has(dir)) {
        dirsHere.add(dir)
        d.sessions += 1
      }
      folders.set(dir, d)
    }
    for (const [path, reads, mentions, routed] of s.docs) {
      const d = docs.get(path) ?? { path, reads: 0, sessions: 0, ledSomewhere: 0, ledTo: [], mentions: 0, led: new Set<string>() }
      d.reads += reads
      d.sessions += 1
      d.mentions = Math.max(d.mentions, mentions)
      if (routed.length > 0) d.ledSomewhere += 1
      for (const r of routed) d.led.add(r)
      docs.set(path, d)
    }
  }

  const since = summaries.map(s => s.at).sort()[0]
  return {
    sessions: summaries.length,
    ...(since === undefined ? {} : { since }),
    searches,
    ...(edited === 0 ? {} : { avgBefore: Math.round(before / edited) }),
    files: [...files.values()].sort((a, b) => b.reads - a.reads || b.sessions - a.sessions),
    docs: [...docs.values()]
      .map(({ led, ...d }) => ({ ...d, ledTo: [...led] }))
      .sort((a, b) => b.sessions - a.sessions || b.ledSomewhere - a.ledSomewhere),
    unmapped: [...folders.values()]
      .map(({ seen: _, ...d }) => d)
      .filter(d => d.searches > 0 || d.files > 1)
      .sort((a, b) => b.searches - a.searches || b.sessions - a.sessions),
  }
}

/** The verdict on a doc across sessions. */
export const describeProjectDoc = (d: ProjectDoc): string => {
  const read = `read in ${d.sessions} session${d.sessions === 1 ? '' : 's'}`
  if (d.ledSomewhere === 0) return `${read}, led nowhere${d.mentions === 0 ? ' (names no paths)' : ''}`
  return `${read}, led somewhere in ${d.ledSomewhere} (${d.ledTo.length} file${d.ledTo.length === 1 ? '' : 's'})`
}

const cell = (text: string) => text.replace(/\|/g, '\\|')

export const projectReportOf = (p: ProjectInsights, project: string): string => {
  const out: string[] = []
  out.push(`# Reading report across sessions: ${project}`, '')
  if (p.sessions === 0) return [...out, 'No sessions recorded for this project yet.'].join('\n')
  const opened = p.files.length
  out.push(
    `${p.sessions} session${p.sessions === 1 ? '' : 's'} since ${p.since?.slice(0, 10)}, ${opened} distinct files opened, ` +
      `${p.searches} codebase searches` +
      (p.avgBefore === undefined ? '.' : `, ${p.avgBefore} calls before the first edit on average.`),
    '',
  )
  out.push(
    'How to read this: a doc "led somewhere" in a session when a file it names (by path or folder) was opened ' +
      'after it for the first time. A folder lands under "searched for" when files there were found by searching ' +
      'with no doc read before naming them. CLAUDE.md and skills load without a tool call and do not show here.',
    '',
  )
  out.push('## Docs', '')
  if (p.docs.length === 0) out.push('No doc was read with a tool.', '')
  else {
    out.push('| Doc | Sessions read | Led somewhere | Reads | Files it led to |', '| --- | --- | --- | --- | --- |')
    for (const d of p.docs) {
      out.push(`| ${cell(d.path)} | ${d.sessions} | ${d.ledSomewhere} | ${d.reads} | ${cell(d.ledTo.slice(0, 15).join(', '))}${d.ledTo.length > 15 ? ` +${d.ledTo.length - 15}` : ''} |`)
    }
    out.push('')
  }
  out.push('## Searched for, no doc pointing there', '')
  if (p.unmapped.length === 0) out.push('None.', '')
  else {
    out.push('| Folder | Sessions | Searches before | Files |', '| --- | --- | --- | --- |')
    for (const d of p.unmapped.slice(0, 40)) out.push(`| ${cell(d.dir || './')} | ${d.sessions} | ${d.searches} | ${d.files} |`)
    out.push('')
  }
  out.push('## Most read files', '')
  out.push('| File | Role | Reads | Sessions | Reached via a doc | Searches before |', '| --- | --- | --- | --- | --- | --- |')
  for (const f of p.files.slice(0, 60)) {
    out.push(`| ${cell(f.path)} | ${f.role} | ${f.reads} | ${f.sessions} | ${f.routed} of ${f.sessions} | ${f.searches} |`)
  }
  out.push('')
  out.push(
    'Use this to restructure the docs: point an existing doc or a new map at the folders searched for again and ' +
      'again, cut or rework the docs that are read but lead nowhere, and give the most read large files a section index.',
  )
  return out.join('\n')
}
