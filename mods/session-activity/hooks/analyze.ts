import type { Activity, LineRange } from '../types'

export type Role = 'doc' | 'code' | 'test' | 'config'

/** What a file is to someone structuring docs: prose meant for readers, code, tests or config. */
export const roleOf = (path: string): Role => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  if (/\.(md|mdx|markdown|rst|adoc|txt)$/i.test(name) || /^(README|CLAUDE|AGENTS|ARCHITECTURE|CONTRIBUTING)\b/i.test(name)) return 'doc'
  if (/__tests__|\/tests?\/|[._-](test|spec)\.\w+$/i.test(path)) return 'test'
  if (/\.(json|jsonc|ya?ml|toml|ini|lock|cfg|conf|env)$/i.test(name) || name.startsWith('.')) return 'config'
  return 'code'
}

const WRAPPERS = new Set(['sudo', 'time', 'env', 'command', 'exec', 'nohup', 'xargs'])
const SEARCHERS = new Set(['grep', 'egrep', 'rg', 'ag', 'ack', 'find', 'fd', 'ls', 'tree', 'locate'])

/** The programs a command line runs: the first word of each piece between pipes, `&&`, `||` and `;`. */
export const programsOf = (command: string): string[] => {
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

/** A call that looks through the codebase for something: Grep, Glob, or a shell grep, find or ls. */
export const isSearch = (one: Activity) =>
  one.tool === 'Grep' || one.tool === 'Glob' || (one.tool === 'Bash' && programsOf(one.target).some(p => SEARCHERS.has(p)))

const isFileKind = (one: Activity) => one.kind === 'read' || one.kind === 'edit' || one.kind === 'write'

/** The file and folder paths a doc's text names, as written (`src/auth/`, `./api.ts`, `ARCHITECTURE.md`). */
export const mentionsOf = (content: string, max = 300): string[] => {
  const found = new Set<string>()
  for (const match of content.matchAll(/(?:\.{0,2}\/)?(?:[\w@.-]+\/)*[\w@-][\w@.-]*(?:\.[A-Za-z][\w]{0,5}\b|\/)/g)) {
    const token = match[0].replace(/^\.\//, '')
    if (token.length < 3 || /^\/\/|^https?:/.test(token)) continue
    if (!token.includes('/') && !/\.[A-Za-z]\w{0,5}$/.test(token)) continue
    found.add(token)
    if (found.size >= max) break
  }
  return [...found]
}

/** Whether a doc's mention points at this file, or at a folder it sits in. */
export const mentionMatches = (path: string, mention: string) => {
  const m = mention.replace(/^(\.\.?\/)+/, '').replace(/^\//, '')
  if (m === '' || m === '/') return false
  if (m.endsWith('/')) return path.includes('/' + m) || path.startsWith(m)
  return path === m || path.endsWith('/' + m)
}

export type FileInsight = {
  path: string
  role: Role
  reads: number
  edits: number
  writes: number
  errors: number
  ranges: LineRange[]
  total?: number
  /** Index of the latest call on the file, to break ties by recency. */
  last: number
  /** Codebase searches in its loop since the previous newly opened file, before this one was first opened. */
  searchesBefore: number
  /** The doc read earlier whose text mentions this file or its folder. */
  routedBy?: string
  bySubagent: boolean
}

export type DocInsight = { path: string; reads: number; mentions: number; routed: string[] }
export type DirInsight = { dir: string; files: number; reads: number; searches: number }
export type TurnInsight = { turn: number; before: number; reads: number; searches: number; hasEdit: boolean }

export type Insights = {
  files: FileInsight[]
  docs: DocInsight[]
  /** Folders the agent found by searching, with no doc it read pointing there: where a map would help. */
  unmapped: DirInsight[]
  turns: TurnInsight[]
  searches: number
}

export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)

export const analyze = (list: Activity[]): Insights => {
  const files = new Map<string, FileInsight>()
  const docs = new Map<string, DocInsight & { said: Set<string> }>()
  const turns = new Map<number, TurnInsight>()
  const since = new Map<string, number>()
  let searches = 0
  let lastTurn = -1

  list.forEach((one, index) => {
    const loop = one.agent ?? 'main'
    const turnNo = one.turn ?? 0
    if (turnNo !== lastTurn) {
      since.clear()
      lastTurn = turnNo
    }
    const turn = turns.get(turnNo) ?? { turn: turnNo, before: 0, reads: 0, searches: 0, hasEdit: false }
    turns.set(turnNo, turn)
    const searching = isSearch(one)
    if (searching) {
      searches += 1
      since.set(loop, (since.get(loop) ?? 0) + 1)
    }
    const changes = (one.kind === 'edit' || one.kind === 'write') && loop === 'main' && !one.isError
    if (changes) turn.hasEdit = true
    else if (!turn.hasEdit) {
      turn.before += 1
      if (one.kind === 'read') turn.reads += 1
      if (searching) turn.searches += 1
    }

    if (!isFileKind(one) || one.target === '') return
    let row = files.get(one.target)
    if (row === undefined) {
      row = {
        path: one.target, role: roleOf(one.target), reads: 0, edits: 0, writes: 0, errors: 0, ranges: [],
        last: index, searchesBefore: since.get(loop) ?? 0, bySubagent: one.agent !== undefined,
      }
      since.set(loop, 0)
      for (const doc of [...docs.values()].reverse()) {
        if (doc.path === one.target || ![...doc.said].some(m => mentionMatches(one.target, m))) continue
        row.routedBy = doc.path
        doc.routed.push(one.target)
        break
      }
      files.set(one.target, row)
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
    if (one.agent === undefined) row.bySubagent = false

    if (one.kind === 'read' && row.role === 'doc' && !one.isError) {
      const doc = docs.get(one.target) ?? { path: one.target, reads: 0, mentions: 0, routed: [], said: new Set<string>() }
      doc.reads += 1
      for (const m of one.mentions ?? []) doc.said.add(m)
      doc.mentions = doc.said.size
      docs.delete(one.target)
      docs.set(one.target, doc)
    }
  })

  const dirs = new Map<string, DirInsight>()
  for (const row of files.values()) {
    if (row.role === 'doc' || row.routedBy !== undefined || row.reads === 0) continue
    const dir = dirOf(row.path)
    const d = dirs.get(dir) ?? { dir, files: 0, reads: 0, searches: 0 }
    d.files += 1
    d.reads += row.reads
    d.searches += row.searchesBefore
    dirs.set(dir, d)
  }

  return {
    files: [...files.values()].sort(
      (a, b) => b.reads - a.reads || b.edits + b.writes - (a.edits + a.writes) || b.last - a.last,
    ),
    docs: [...docs.values()]
      .map(({ said: _, ...doc }) => doc)
      .sort((a, b) => b.routed.length - a.routed.length || b.reads - a.reads),
    unmapped: [...dirs.values()]
      .filter(d => d.searches > 0 || d.files > 1)
      .sort((a, b) => b.searches - a.searches || b.files - a.files || b.reads - a.reads),
    turns: [...turns.values()].filter(t => t.turn > 0).sort((a, b) => a.turn - b.turn),
    searches,
  }
}

export const merge = (ranges: LineRange[]): LineRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const out: LineRange[] = []
  for (const r of sorted) {
    const prev = out[out.length - 1]
    if (prev !== undefined && r.start <= prev.end + 1) prev.end = Math.max(prev.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

export const describeLines = (row: FileInsight): string => {
  if (row.ranges.length === 0) return row.reads > 0 ? 'lines unknown' : ''
  const merged = merge(row.ranges)
  const spans = merged.map(r => (r.start === r.end ? `${r.start}` : `${r.start}–${r.end}`)).join(', ')
  if (row.total === undefined || row.total === 0) return `lines ${spans}`
  const covered = merged.reduce((sum, r) => sum + Math.min(r.end, row.total!) - r.start + 1, 0)
  if (covered >= row.total) return `all ${row.total} lines`
  return `lines ${spans} of ${row.total} · ${Math.round((covered / row.total) * 100)}%`
}

/** How the agent got to a file: a doc that names it, or the searches it took. */
export const describeFound = (row: FileInsight, rel: (p: string) => string): string => {
  if (row.routedBy !== undefined) return `via ${rel(row.routedBy)}`
  if (row.searchesBefore > 0) return `found after ${row.searchesBefore} search${row.searchesBefore === 1 ? '' : 'es'}`
  return ''
}

/** The docs verdict: did reading it lead anywhere? */
export const describeDoc = (doc: DocInsight): string => {
  if (doc.routed.length > 0) return `led to ${doc.routed.length} file${doc.routed.length === 1 ? '' : 's'}`
  if (doc.mentions === 0) return 'names no paths'
  return `names ${doc.mentions} path${doc.mentions === 1 ? '' : 's'}, none opened after`
}
