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

test('the tools tab counts the programs Bash ran and shows each command from its start', async ($, on) => {
  on('tool.call', { tool: 'Bash' }, async () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }) as never)
  await $.tool.call({ tool: 'Bash', command: 'cd /Users/jan/dev && git status -sb | head -1' })
  await $.tool.call({ tool: 'Bash', command: 'git log --oneline -1' })
  await $.tool.call({ tool: 'Bash', command: "cat > f <<'EOF'\nfoo | bar\nEOF\nFOO=1 git add f; \"$C\" plugin test ." })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-activity',
      surface,
      component: 'Pane',
      requestId: 'session-activity',
      props: {},
    } as never)
    await ui.press({ key: 'tab-tools' })
    expect(await ui.find({ text: /Bash ×3/ })).toBeDefined()
    expect(await ui.find({ text: /^ git 3 · cat 1 · head 1$/ })).toBeDefined()
    expect(await ui.find({ text: /^ git status -sb \| head -1$/ })).toBeDefined()
    await ui.press({ key: 'tab-files' })
    await ui.unmount()
  }
})

test('the docs tab shows which docs led to files and which folders needed searching', async ($, on) => {
  on('session.cwd', async () => ({ value: '/proj' }) as never)
  on('tool.call', { tool: 'Read' }, async (_$, e) => {
    const path = (e as unknown as { file_path: string }).file_path
    const content = path.endsWith('.md') ? 'Auth lives in `src/auth/`; see src/auth/login.ts.' : 'code'
    return { result: { type: 'text', file: { filePath: path, content, numLines: 10, startLine: 1, totalLines: 10 } }, text: '' } as never
  })
  on('tool.call', { tool: 'Bash' }, async () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }) as never)
  await $.tool.call({ tool: 'Read', file_path: '/proj/docs/ARCHITECTURE.md' })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/auth/login.ts' })
  await $.tool.call({ tool: 'Bash', command: 'rg -n invoice src' })
  await $.tool.call({ tool: 'Read', file_path: '/proj/src/billing/pay.ts' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'session-activity',
      surface,
      component: 'Pane',
      requestId: 'session-activity',
      props: {},
    } as never)
    expect(await ui.find({ text: /via docs\/ARCHITECTURE\.md/ })).toBeDefined()
    expect(await ui.find({ text: /found after 1 search/ })).toBeDefined()
    await ui.press({ key: 'tab-docs' })
    expect(await ui.find({ text: /led to 1 file: login\.ts/ })).toBeDefined()
    expect(await ui.find({ text: /src\/billing\/ 1 file · 1 search$/ })).toBeDefined()
    await ui.press({ key: 'tab-files' })
    await ui.unmount()
  }
})
