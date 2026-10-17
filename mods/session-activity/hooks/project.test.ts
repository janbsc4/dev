import { test, expect } from 'claude-code/testing'

import type { SessionSummary } from './project'
import { MAX_SESSIONS, aggregate, projectReportOf, withSession } from './project'

const session = (at: string, more: Partial<SessionSummary> = {}): SessionSummary => ({
  at, searches: 0, edited: 0, before: 0, files: [], docs: [], ...more,
})

test('sessions add up per doc, folder and file, and a re-save replaces rather than adds', async () => {
  let history = withSession(undefined, 'a', session('2026-10-01T00:00:00Z', {
    searches: 3, edited: 1, before: 8,
    files: [
      ['ARCHITECTURE.md', 'doc', 1, 0, ''],
      ['src/auth/login.ts', 'code', 2, 0, 'ARCHITECTURE.md'],
      ['src/billing/pay.ts', 'code', 1, 3, ''],
    ],
    docs: [['ARCHITECTURE.md', 1, 4, ['src/auth/login.ts']], ['README.md', 1, 2, []]],
  }))
  const second = session('2026-10-02T00:00:00Z', {
    searches: 2, edited: 1, before: 4,
    files: [['src/billing/pay.ts', 'code', 3, 2, ''], ['src/billing/tax.ts', 'code', 1, 0, '']],
    docs: [['README.md', 1, 2, []]],
  })
  history = withSession(history, 'b', second)
  history = withSession(history, 'b', second)

  const p = aggregate(history)
  expect(p.sessions).toBe(2)
  expect(p.avgBefore).toBe(6)
  expect(p.files[0]).toEqual({ path: 'src/billing/pay.ts', role: 'code', reads: 4, sessions: 2, searches: 5, routed: 0 })
  expect(p.docs.map(d => [d.path, d.sessions, d.ledSomewhere])).toEqual([
    ['README.md', 2, 0],
    ['ARCHITECTURE.md', 1, 1],
  ])
  expect(p.unmapped).toEqual([{ dir: 'src/billing/', sessions: 2, searches: 5, files: 2 }])

  const report = projectReportOf(p, '/proj')
  expect(report).toContain('| README.md | 2 | 0 | 2 |  |')
  expect(report).toContain('| src/billing/ | 2 | 5 | 2 |')
})

test('a project keeps only its newest sessions', async () => {
  let history = withSession(undefined, 's0', session('2026-01-01T00:00:00Z'))
  for (let i = 1; i <= MAX_SESSIONS; i += 1) {
    history = withSession(history, `s${i}`, session(`2026-02-${String(i).padStart(2, '0')}T00:00:00Z`))
  }
  expect(Object.keys(history.sessions)).toHaveLength(MAX_SESSIONS)
  expect(history.sessions.s0).toBeUndefined()
})

test('a finished turn saves the session under its project and the Project tab adds earlier sessions', async ($, on) => {
  const store = new Map<string, unknown>([[
    'project:/proj',
    {
      sessions: {
        earlier: session('2026-10-01T00:00:00Z', {
          files: [['src/billing/pay.ts', 'code', 2, 4, '']],
          docs: [['README.md', 1, 3, []]],
        }),
      },
    },
  ]])
  on('store.get', async (_$, e) => ({ value: store.get((e as { key: string }).key) }) as never)
  on('store.set', async (_$, e) => {
    const { key, value } = e as { key: string; value: unknown }
    store.set(key, JSON.parse(JSON.stringify(value)))
    return { value: undefined } as never
  })
  on('session.cwd', async () => ({ value: '/proj' }) as never)
  on('session.id', async () => ({ value: 'now' }) as never)
  on('turn.complete', async () => ({ text: '' }) as never)
  on('tool.call', { tool: 'Read' }, async (_$, e) => {
    const path = (e as unknown as { file_path: string }).file_path
    return { result: { type: 'text', file: { filePath: path, content: 'x', numLines: 1, startLine: 1, totalLines: 1 } }, text: '' } as never
  })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/billing/pay.ts' })
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: false, reason: 'answer' } as never)

  const saved = store.get('project:/proj') as { sessions: Record<string, SessionSummary> }
  expect(Object.keys(saved.sessions).sort()).toEqual(['earlier', 'now'])
  expect(saved.sessions.now?.files[0]?.[0]).toBe('src/billing/pay.ts')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-activity', surface, component: 'Pane', requestId: 'session-activity', props: {},
    } as never)
    await ui.press({ key: 'tab-project' })
    expect(await ui.find({ text: /2 sessions in this project since 2026-10-01/ })).toBeDefined()
    expect(await ui.find({ text: /README\.md read in 1 session, led nowhere/ })).toBeDefined()
    expect(await ui.find({ text: /src\/billing\/ in 2 sessions · 4 searches · 1 file/ })).toBeDefined()
    expect(await ui.find({ text: /3× pay\.ts in 2 sessions/ })).toBeDefined()
    await ui.press({ key: 'tab-files' })
    await ui.unmount()
  }
})
