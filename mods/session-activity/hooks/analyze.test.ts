import { test, expect } from 'claude-code/testing'

import type { Activity } from '../types'
import { analyze, mentionsOf, programsOf, roleOf } from './analyze'
import { reportArgsOf, reportOf } from './report'

let n = 0
const call = (tool: string, target: string, more: Partial<Activity> = {}): Activity => ({
  id: `t${(n += 1)}`,
  tool,
  kind: tool === 'Read' ? 'read' : tool === 'Edit' ? 'edit' : tool === 'Bash' ? 'run' : 'search',
  target,
  isDone: true,
  isError: false,
  turn: 1,
  ...more,
})

test('roles, programs and mentions', async () => {
  expect(roleOf('/p/docs/ARCHITECTURE.md')).toBe('doc')
  expect(roleOf('/p/CLAUDE.md')).toBe('doc')
  expect(roleOf('/p/src/a.test.ts')).toBe('test')
  expect(roleOf('/p/package.json')).toBe('config')
  expect(roleOf('/p/src/a.ts')).toBe('code')
  expect(programsOf('rg foo src | head -3 && ls -la')).toEqual(['rg', 'head', 'ls'])
  expect(mentionsOf('See `src/auth/` and lib/db.ts, version 0.6.7, https://x.io/a.html')).toEqual(
    expect.arrayContaining(['src/auth/', 'lib/db.ts']),
  )
  expect(mentionsOf('version 0.6.7 only')).toEqual([])
})

test('a doc that names a file routes it; a file found by searching marks its folder as unmapped', async () => {
  const insights = analyze([
    call('Read', '/p/ARCHITECTURE.md', { mentions: ['src/auth/', 'lib/db.ts'] }),
    call('Read', '/p/src/auth/login.ts'),
    call('Grep', 'invoice'),
    call('Bash', 'rg -n charge src'),
    call('Read', '/p/src/billing/pay.ts'),
    call('Read', '/p/src/billing/pay.ts'),
    call('Edit', '/p/src/billing/pay.ts'),
    call('Read', '/p/README.md', { mentions: ['docs/setup.md'] }),
  ])
  const byPath = new Map(insights.files.map(f => [f.path, f]))
  expect(byPath.get('/p/src/auth/login.ts')?.routedBy).toBe('/p/ARCHITECTURE.md')
  expect(byPath.get('/p/src/billing/pay.ts')?.searchesBefore).toBe(2)
  expect(insights.files[0]?.path).toBe('/p/src/billing/pay.ts')
  expect(insights.docs.map(d => [d.path, d.routed.length])).toEqual([
    ['/p/ARCHITECTURE.md', 1],
    ['/p/README.md', 0],
  ])
  expect(insights.unmapped).toEqual([{ dir: '/p/src/billing/', files: 1, reads: 2, searches: 2 }])
  expect(insights.turns).toEqual([{ turn: 1, before: 6, reads: 4, searches: 2, hasEdit: true }])

  const report = reportOf(insights, p => p.replace('/p/', ''))
  expect(report).toContain('| ARCHITECTURE.md | 1 | led to 1 file | src/auth/login.ts |')
  expect(report).toContain('| README.md | 1 | names 1 path, none opened after |  |')
  expect(report).toContain('| src/billing/ | 1 | 2 | 2 |')
})

test('activity-report arguments: a leading keyword, the rest as the ask', () => {
  expect(reportArgsOf('')).toEqual({ ask: '' })
  expect(reportArgsOf(' project ')).toEqual({ mode: 'project', ask: '' })
  expect(reportArgsOf('RESET')).toEqual({ mode: 'reset', ask: '' })
  expect(reportArgsOf('project update the README')).toEqual({ mode: 'project', ask: 'update the README' })
  expect(reportArgsOf('projects are hard')).toEqual({ ask: 'projects are hard' })
})
