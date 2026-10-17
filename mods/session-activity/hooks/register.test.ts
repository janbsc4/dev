import { test, expect } from 'claude-code/testing'

const readResult = (path: string, startLine: number, numLines: number, totalLines: number) => ({
  result: { type: 'text', file: { filePath: path, content: '', numLines, startLine, totalLines } },
  text: 'ok',
})

test('the pane puts the most read file first and shows the lines read', async ($, on) => {
  on('tool.call', { tool: 'Read' }, async (_$, e) => {
    const input = e as unknown as { file_path: string; offset?: number; limit?: number }
    const start = input.offset ?? 1
    return readResult(input.file_path, start, input.limit ?? 100, 400) as never
  })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/b.ts', offset: 1, limit: 50 })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/b.ts', offset: 201, limit: 100 })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-activity',
      surface,
      component: 'Pane',
      requestId: 'session-activity',
      props: {},
    } as never)
    const names = await ui.findAll({ text: /^[ab]\.ts$/ })
    expect(names.map(n => n.text)).toEqual(['b.ts', 'a.ts'])
    expect(await ui.find({ text: /lines 1–50, 201–300 of 400 · 38%/ })).toBeDefined()
    expect(await ui.find({ text: /lines 1–100 of 400 · 25%/ })).toBeDefined()
    await ui.press({ key: 'tab-tools' })
    expect(await ui.find({ text: /L201–300/ })).toBeDefined()
    await ui.press({ key: 'tab-files' })
    await ui.unmount()
  }
})
