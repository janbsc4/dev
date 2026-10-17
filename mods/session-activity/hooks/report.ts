import type { Insights } from './analyze'
import { describeDoc, describeFound, describeLines } from './analyze'

const cell = (text: string) => text.replace(/\|/g, '\\|')

/**
 * The session's reading as Markdown: what `/activity-report` hands the model, so it can say which docs and
 * maps helped, which were dead weight and where one is missing.
 */
export const reportOf = (insights: Insights, rel: (p: string) => string): string => {
  const { files, docs, unmapped, turns, searches } = insights
  const opened = files.filter(f => f.reads > 0)
  const routed = opened.filter(f => f.routedBy !== undefined)
  const out: string[] = []

  out.push('# Session reading report', '')
  out.push(
    `${opened.length} files opened (${opened.filter(f => f.role === 'doc').length} docs), ` +
      `${searches} codebase searches, ${routed.length} files reached through a doc's mention, ` +
      `${opened.filter(f => f.bySubagent).length} opened only by subagents.`,
    '',
  )
  out.push(
    'How to read this: "led to" counts files first opened after the doc that the doc names (by path or folder). ' +
      '"Searches before" counts Grep, Glob and shell grep/find/ls calls since the previous newly opened file. ' +
      'Docs loaded automatically into context (CLAUDE.md, skills) are not tool calls and do not show here.',
    '',
  )

  out.push('## Orientation per turn', '')
  if (turns.length === 0) out.push('No turns recorded.', '')
  else {
    out.push('| Turn | Calls before first edit | Reads | Searches |', '| --- | --- | --- | --- |')
    for (const t of turns) out.push(`| ${t.turn} | ${t.hasEdit ? t.before : `${t.before} (no edit)`} | ${t.reads} | ${t.searches} |`)
    out.push('')
  }

  out.push('## Docs read', '')
  if (docs.length === 0) out.push('No docs were read with a tool.', '')
  else {
    out.push('| Doc | Reads | Verdict | Files it led to |', '| --- | --- | --- | --- |')
    for (const d of docs) {
      out.push(`| ${cell(rel(d.path))} | ${d.reads} | ${describeDoc(d)} | ${cell(d.routed.map(rel).join(', '))} |`)
    }
    out.push('')
  }

  out.push('## Found by searching, no doc pointing there', '')
  if (unmapped.length === 0) out.push('None.', '')
  else {
    out.push('| Folder | Files opened | Searches before | Reads |', '| --- | --- | --- | --- |')
    for (const d of unmapped) out.push(`| ${cell(rel(d.dir) || './')} | ${d.files} | ${d.searches} | ${d.reads} |`)
    out.push('')
  }

  out.push('## Every file, most read first', '')
  out.push('| File | Role | Reads | Lines read | Found | Edits |', '| --- | --- | --- | --- | --- | --- |')
  for (const f of files) {
    const found = describeFound(f, rel) || (f.reads > 0 ? 'directly' : '')
    out.push(
      `| ${cell(rel(f.path))} | ${f.role}${f.bySubagent ? ' (subagent)' : ''} | ${f.reads} | ${cell(describeLines(f))} | ${cell(found)} | ${f.edits + f.writes} |`,
    )
  }
  out.push('')
  out.push(
    'Use this to judge the codebase docs: which docs led somewhere, which were read and led nowhere, ' +
      'which folders needed searching that a map or a pointer in an existing doc would have saved, ' +
      'and which large files were read in slices a section index could shortcut.',
  )
  return out.join('\n')
}
