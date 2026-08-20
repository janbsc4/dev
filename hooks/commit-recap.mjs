#!/usr/bin/env node
// SessionStart hook: notice commits by OTHER authors that I have not reviewed yet.
//
// The hook only NOTICES and offers. It never dumps a recap by itself: it prints a
// one-line notice for the user plus instructions for Claude to offer the recap,
// and Claude advances the marker afterwards.
//
// All state lives OUTSIDE any repo, in ~/.claude/commit-review/<repo-slug>.json,
// so nothing here is ever committed.
//
// It looks at BOTH the local HEAD and the remote-tracking default branch, because
// a teammate's commit usually sits on origin/main before it is ever merged locally.
// That is why the reviewed marker is a LIST of tips, not one sha: marking only HEAD
// would leave upstream-only commits pending forever.
//
// Modes:
//   (no args)          hook mode: reads the hook JSON on stdin, emits hook JSON
//   --status           print what the state file says (human readable)
//   --mark [<sha>]     record "reviewed up to here" (defaults to the tips the hook
//                      last reported on, else the current tips)
//   --skip             alias of --mark, for dismissing without a recap
//   --reset            forget the markers (next session looks back FALLBACK_DAYS)
//   --list             print the pending commits as plain text
//
// Env overrides:
//   CC_REVIEW_ME=a@b,c@d     emails that count as "me" (default: git config user.email)
//   CC_REVIEW_INCLUDE_BOTS=1 include [bot] authors (default: excluded)
//   CC_REVIEW_NO_FETCH=1     do not fetch before looking
//   CC_REVIEW_DAYS=7         look-back window when there is no marker yet

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const STATE_DIR = join(homedir(), '.claude', 'commit-review');
const FALLBACK_DAYS = Number(process.env.CC_REVIEW_DAYS || 7);
const MAX_COMMITS = 40;      // how many we list to the model
const SCAN_LIMIT = 500;      // how many raw log records we scan (see note in pendingCommits)
const HISTORY_MAX = 30;
const MARKERS_MAX = 8;
const FETCH_THROTTLE_MS = 5 * 60 * 1000;
const UNIT = '\x1f';
const REC = '\x1e';

const argv = process.argv.slice(2);
const mode =
  argv.find((a) => ['--status', '--mark', '--skip', '--reset', '--list'].includes(a)) || '--hook';
const explicitSha = argv.find((a) => /^[0-9a-f]{7,40}$/i.test(a));

// The project dir Claude Code is working in, not this script's cwd.
const startDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rootProbe = spawnSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: startDir,
  encoding: 'utf8',
  timeout: 5000,
});
if (rootProbe.status !== 0) process.exit(0); // not a git repo: stay silent
const repoRoot = rootProbe.stdout.trim();

function git(args, { timeout = 10000 } = {}) {
  const r = spawnSync('git', args, {
    cwd: repoRoot,
    timeout,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
  });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

const slug = repoRoot.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repo';
const statePath = join(STATE_DIR, `${slug}.json`);

function readState() {
  try {
    const s = JSON.parse(readFileSync(statePath, 'utf8'));
    // Tolerate the single-sha shape an earlier version wrote.
    if (!Array.isArray(s.markers)) s.markers = s.marker ? [s.marker] : [];
    return s;
  } catch {
    return { repo: repoRoot, markers: [], reviewedAt: null, pending: null, history: [] };
  }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const { marker, ...rest } = state; // drop the legacy key on first rewrite
  writeFileSync(statePath, `${JSON.stringify(rest, null, 2)}\n`);
}

function maybeFetch() {
  if (process.env.CC_REVIEW_NO_FETCH === '1') return;
  const head = join(repoRoot, '.git', 'FETCH_HEAD');
  try {
    if (existsSync(head) && Date.now() - statSync(head).mtimeMs < FETCH_THROTTLE_MS) return;
  } catch {
    /* fall through and fetch */
  }
  git(['fetch', '--quiet', '--prune', '--no-tags'], { timeout: 8000 });
}

// Every tip a teammate's work could be sitting on: local HEAD and the remote
// default branch.
function tips() {
  const out = [];
  const head = git(['rev-parse', 'HEAD']);
  if (head) out.push(head);
  let upstreamRef = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (!upstreamRef) {
    for (const candidate of ['origin/main', 'origin/master']) {
      if (git(['rev-parse', '--verify', '--quiet', candidate])) {
        upstreamRef = candidate;
        break;
      }
    }
  }
  if (upstreamRef) {
    const sha = git(['rev-parse', upstreamRef]);
    if (sha && !out.includes(sha)) out.push(sha);
  }
  return out;
}

const liveMarkers = (markers) =>
  (markers || []).filter((m) => git(['cat-file', '-e', `${m}^{commit}`]) !== null);

// Replace the markers with the newly reviewed tips, but keep any old marker that
// is NOT already contained in them (branch switches, force pushes) so reviewed
// commits cannot reappear.
function nextMarkers(newTips, oldMarkers) {
  const kept = liveMarkers(oldMarkers).filter(
    (old) => !newTips.some((tip) => git(['merge-base', '--is-ancestor', old, tip]) !== null),
  );
  return [...newTips, ...kept].slice(0, MARKERS_MAX);
}

const meEmails = (process.env.CC_REVIEW_ME || git(['config', 'user.email']) || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const isMe = (email) => meEmails.includes(email.toLowerCase());
const isBot = (name, email) =>
  /\[bot\]/i.test(name) || /\[bot\]/i.test(email) || /^(dependabot|github-actions)@/i.test(email);

function pendingCommits(state) {
  const tipList = tips();
  if (!tipList.length) return { tipList, commits: [], markers: [] };

  const markers = liveMarkers(state.markers);
  const args = [
    'log',
    '--no-merges',
    `-n${SCAN_LIMIT}`,
    '--date=short',
    `--pretty=format:%H${UNIT}%an${UNIT}%ae${UNIT}%ad${UNIT}%s${UNIT}%b${REC}`,
    ...tipList,
  ];
  if (markers.length) args.push('--not', ...markers);
  else args.push(`--since=${FALLBACK_DAYS}.days`);

  const raw = git(args, { timeout: 15000 }) || '';
  const commits = raw
    .split(REC)
    .map((rec) => rec.replace(/^\n/, ''))
    .filter((rec) => rec.trim())
    .map((rec) => {
      const [sha, name, email, date, subject, body = ''] = rec.split(UNIT);
      return { sha, name, email, date, subject, hasBody: body.trim().length > 0 };
    })
    .filter((c) => c.sha && !isMe(c.email))
    .filter((c) => (process.env.CC_REVIEW_INCLUDE_BOTS === '1' ? true : !isBot(c.name, c.email)));

  return { tipList, commits, markers };
}

const state = readState();

if (mode === '--status') {
  const { commits, markers } = pendingCommits(state);
  console.log(`repo:        ${repoRoot}`);
  console.log(`state file:  ${statePath}`);
  console.log(`me:          ${meEmails.join(', ') || '(unknown)'}`);
  console.log(
    `markers:     ${markers.length ? markers.map((m) => m.slice(0, 8)).join(', ') : `(none, looking back ${FALLBACK_DAYS} days)`}`,
  );
  console.log(`reviewed at: ${state.reviewedAt || '(never)'}`);
  console.log(`pending:     ${commits.length} commit(s) by others`);
  for (const c of commits) console.log(`  ${c.sha.slice(0, 8)} ${c.date} ${c.name}: ${c.subject}`);
  if (state.history?.length) {
    console.log('history:');
    for (const h of state.history.slice(-5))
      console.log(`  ${h.reviewedAt}  ${h.action}  ${h.count ?? '?'} commit(s)`);
  }
  process.exit(0);
}

if (mode === '--list') {
  const { commits } = pendingCommits(state);
  for (const c of commits) console.log(`${c.sha} ${c.date} ${c.name} <${c.email}> ${c.subject}`);
  process.exit(0);
}

if (mode === '--reset') {
  writeState({ ...state, repo: repoRoot, markers: [], reviewedAt: null, pending: null });
  console.log(`Markers cleared. Next session looks back ${FALLBACK_DAYS} days.`);
  process.exit(0);
}

if (mode === '--mark' || mode === '--skip') {
  // Prefer the tips the hook actually reported on, so commits that landed between
  // the notice and the recap are not silently marked as reviewed.
  const reviewedTips = explicitSha
    ? [git(['rev-parse', explicitSha])].filter(Boolean)
    : state.pending?.tips?.length
      ? state.pending.tips
      : tips();
  if (!reviewedTips.length) {
    console.error('Nothing to mark: could not resolve a commit.');
    process.exit(1);
  }
  const now = new Date().toISOString();
  const count = state.pending?.count ?? null;
  writeState({
    ...state,
    repo: repoRoot,
    markers: nextMarkers(reviewedTips, state.markers),
    reviewedAt: now,
    pending: null,
    history: [
      ...(state.history || []),
      { reviewedAt: now, tips: reviewedTips.map((t) => t.slice(0, 8)), count, action: mode.slice(2) },
    ].slice(-HISTORY_MAX),
  });
  console.log(
    `Marked reviewed up to ${reviewedTips.map((t) => t.slice(0, 8)).join(' + ')}${count != null ? ` (${count} commit(s))` : ''}.`,
  );
  process.exit(0);
}

// --- hook mode -------------------------------------------------------------

maybeFetch();
const { tipList, commits } = pendingCommits(state);
if (!commits.length) process.exit(0); // nothing by anyone else: say nothing at all

const shown = commits.slice(0, MAX_COMMITS);
const truncated = commits.length > MAX_COMMITS;
const byAuthor = new Map();
for (const c of shown) byAuthor.set(c.name, (byAuthor.get(c.name) || 0) + 1);
const authorSummary = [...byAuthor.entries()].map(([n, k]) => `${n} (${k})`).join(', ');
const since = state.reviewedAt
  ? `since your last review on ${state.reviewedAt.slice(0, 10)}`
  : `in the last ${FALLBACK_DAYS} days`;

writeState({
  ...state,
  repo: repoRoot,
  pending: { tips: tipList, count: commits.length, noticedAt: new Date().toISOString() },
});

const list = shown
  .map(
    (c) =>
      `- ${c.sha.slice(0, 8)}  ${c.date}  ${c.name}: ${c.subject}${c.hasBody ? '' : '  [no body, no stated reason]'}`,
  )
  .join('\n');

const systemMessage =
  `${commits.length} commit${commits.length === 1 ? '' : 's'} by other people ${since}: ${authorSummary}. ` +
  `Ask for a recap, or say "mark reviewed" to dismiss.`;

const additionalContext = `<unreviewed-commits repo="${repoRoot}">
${commits.length} commit(s) authored by someone other than the user (${meEmails.join(', ')}) landed ${since}.
Merge commits and bot commits are already filtered out. Both local HEAD and the
remote default branch were checked, so some of these may not be merged locally yet.

${list}${truncated ? `\n(+${commits.length - MAX_COMMITS} more, list capped)` : ''}

How to handle this:
1. Do NOT recap unprompted. The user has already seen a one-line notice. If their
   first message is about something else, answer that instead and leave this alone;
   offer the recap in a single closing sentence at most.
2. If they ask for the recap: read each commit properly before summarising, with
   \`git show -s --format='%H%n%an%n%ad%n%n%B' <sha>\` and \`git show --stat <sha>\`.
   This repo requires a "why" paragraph in the commit body (see CLAUDE.md, "Mensajes
   de commit"), so report BOTH what changed and the reasoning the author gave, and
   say plainly when a commit gave none.
3. After delivering the recap, or if the user dismisses it, run:
     node ~/.claude/hooks/commit-review-recap.mjs --mark
   That advances the review marker so these commits are not offered again. Do not
   run it before the recap has actually been delivered or declined.
</unreviewed-commits>`;

process.stdout.write(
  `${JSON.stringify({
    systemMessage,
    suppressOutput: true,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext },
  })}\n`,
);
