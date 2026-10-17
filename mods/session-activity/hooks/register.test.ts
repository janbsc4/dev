import { test, expect } from 'claude-code/testing'

test('the pane lists files and tools the session used', async ($, on) => {
  on('tool.call', { tool: 'Read' }, async () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/a.ts' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-activity',
      surface,
      component: 'Pane',
      requestId: 'session-activity',
      props: {},
    } as never)
    expect(await ui.find({ text: /a\.ts/ })).toBeDefined()
    await ui.press({ key: 'tab-tools' })
    expect(await ui.find({ text: /Read/ })).toBeDefined()
    await ui.unmount()
  }
})
