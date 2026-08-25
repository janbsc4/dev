# Recipe: commit recap hook

Use this recipe to create a session-start hook that fetches the repository, notices commits made by other people since the last review together with their branch context, and makes the acting agent mention the available recap directly in its first response. It records review state, not an activity log.

The Git scanner and the hook integration must remain separate. The scanner produces neutral data. A small adapter translates that data into the hook format supported by the installed coding agent.

## Result

The finished hook must:

- run once near the start of an agent session
- fetch and prune the configured remote before each scan unless fetching is explicitly disabled
- inspect all local branches and all branches from the configured remote
- find unseen, non-merge commits authored by other people
- record which branches contain each pending commit
- report whether each branch is current and whether it is ahead, behind, diverged, in sync, untracked, or remote-only
- ignore common bot accounts unless configured otherwise
- make the acting agent mention the available recap directly in its first response when qualifying commits exist
- remain silent outside Git repositories and when nothing is pending
- mark commits reviewed only after delivering the recap or after explicit dismissal
- preserve separate review markers across branch switches and divergent history
- keep state outside the repository
- avoid model names, vendor directories, and vendor-specific hook fields in the scanner

## 1. Discover the hook contract

Inspect the target agent's documentation, help output, and existing project configuration. Identify:

1. The event that runs once when a session starts or resumes.
2. The project-level hook configuration path.
3. The command action format and command working directory.
4. The event payload, environment variables, timeout, and stdout contract.
5. How a hook shows a short user-visible notice.
6. Whether a hook can add private context for the agent without printing it to the user.
7. How configuration changes are reloaded.

Do not assume that event names or JSON fields transfer between agents. Merge the new entry into existing configuration.

This step is complete when the event, configuration path, command format, project-directory source, output channels, timeout, and reload procedure are known.

## 2. Define a neutral scanner contract

Create one standalone scanner, such as `hooks/commit-recap.mjs`. It must work from a terminal without the agent running and must not read hook JSON from stdin.

Use neutral environment variables:

| Variable | Meaning | Default |
| --- | --- | --- |
| `COMMIT_RECAP_PROJECT_DIR` | Directory used to locate the repository | process working directory |
| `COMMIT_RECAP_ME` | Comma-separated author emails to exclude | `git config user.email` |
| `COMMIT_RECAP_INCLUDE_BOTS` | Include bot-authored commits when set to `1` | disabled |
| `COMMIT_RECAP_NO_FETCH` | Skip remote fetch when set to `1` | fetch enabled |
| `COMMIT_RECAP_DAYS` | Initial lookback window | `7` |
| `COMMIT_RECAP_STATE_DIR` | State directory | the platform user-state directory under `commit-recap` |
| `COMMIT_RECAP_REMOTE` | Remote used for default-branch discovery | `origin` |

Support these modes:

```text
commit-recap                 Detect pending commits and emit neutral JSON.
commit-recap --status        Print repository, fetch status, markers, review time, and pending summary.
commit-recap --list          Print pending branches and every pending commit with its branch membership.
commit-recap --mark [rev]    Mark the captured pending tips, or the supplied revision, reviewed.
commit-recap --skip [rev]    Dismiss the same range without producing a recap.
commit-recap --reset         Clear markers and pending state while retaining bounded history.
```

Default mode must emit nothing when there are no pending commits. When commits are pending, print one newline-terminated JSON object with no surrounding prose:

```json
{
  "version": 1,
  "notice": "4 commits across 3 branches by 2 other authors are ready for review",
  "pending": {
    "repository": "/absolute/path/to/repository",
    "period": "since the last review",
    "tips": ["full-tip-sha"],
    "total": 4,
    "truncated": false,
    "branches": [
      {
        "name": "feature/example",
        "ref": "refs/heads/feature/example",
        "tip": "full-tip-sha",
        "current": false,
        "upstream": "origin/feature/example",
        "ahead": 1,
        "behind": 2,
        "state": "diverged",
        "pendingCommits": 3
      }
    ],
    "commits": [
      {
        "sha": "full-commit-sha",
        "date": "2026-08-20",
        "authorName": "Example Author",
        "authorEmail": "author@example.com",
        "subject": "Explain the change",
        "hasBody": true,
        "branches": ["feature/example", "origin/feature/example"]
      }
    ]
  }
}
```

Treat this as data, not as a hook response. The adapter decides how to expose it.

This step is complete when every mode can run directly in a terminal and default mode has one documented, vendor-neutral JSON schema.

## 3. Implement repository and state handling

Implement the scanner with the following behavior.

### Repository selection

Resolve `COMMIT_RECAP_PROJECT_DIR`, falling back to the process working directory. Run `git rev-parse --show-toplevel` there and use the returned root for every later Git command. Disable terminal prompting. Outside a worktree, exit 0 without output.

Use bounded subprocess timeouts. Before collecting refs in default, `--status`, or `--list` mode, run `git fetch --prune --no-tags <remote>` unless `COMMIT_RECAP_NO_FETCH=1`. Attempt the fetch every time one of these scan modes runs; do not hide it behind a time-based throttle. Disable credential prompts. Fetch is best effort, must not prevent local scanning, and must expose its success or failure in `--status` without printing an error in default mode.

### State

Store one JSON state file per canonical repository path. Hash the full path for the filename instead of replacing punctuation, and keep the original path in `state.repo`. Reject a state file whose stored path does not match the current repository.

Use this state shape:

```json
{
  "version": 1,
  "repo": "/absolute/path/to/repository",
  "markers": ["reviewed-tip-sha"],
  "reviewedAt": "2026-08-20T12:00:00.000Z",
  "pending": {
    "tips": ["captured-tip-sha"],
    "count": 4,
    "noticedAt": "2026-08-20T12:30:00.000Z"
  },
  "lastFetchAttemptAt": "2026-08-20T12:29:00.000Z",
  "lastFetchSucceededAt": "2026-08-20T12:29:01.000Z",
  "history": []
}
```

Recover from a missing or malformed file by starting with fresh state. Write updates atomically through a temporary file and rename. Cap history at 30 entries and live markers at 8.

State is required for correctness. Do not add notification logs or session logs.

### Candidate tips

After fetching, collect and deduplicate the tips of:

1. Local `HEAD`, when it resolves to a commit.
2. Every local branch under `refs/heads/`.
3. Every branch under `refs/remotes/<remote>/`, excluding the symbolic `<remote>/HEAD` ref.

Keep stable display names and full ref names. For each local branch, resolve its configured upstream and calculate ahead/behind counts with `git rev-list --left-right --count`; classify it as `ahead`, `behind`, `diverged`, `in-sync`, or `untracked`, and record current-branch status separately. Classify a remote branch without a corresponding local branch as `remote-only`. A current branch may retain its ahead/behind state separately from the `current` flag.

Before scanning, drop markers that no longer resolve to commits. Keep multiple markers so switching branches or encountering rewritten history does not discard unrelated review coverage.

### Pending commits

Run one non-merge Git history query across all candidate tips. With live markers, exclude commits reachable from those markers. Without markers, use `COMMIT_RECAP_DAYS` as the lookback window.

Validate that the day count is a positive integer before invoking Git. Scan at most 500 raw commits and document this limit in `--status` output.

Exclude commits when:

- the author email exactly matches an address in `COMMIT_RECAP_ME`, ignoring case and surrounding whitespace
- the author name or email contains `[bot]`
- the email begins with `dependabot@` or `github-actions@`

Apply bot exclusions only when `COMMIT_RECAP_INCLUDE_BOTS` is not `1`. Use author identity consistently. Record whether each commit body contains non-whitespace text, but do not claim that a nonempty body contains a useful rationale.

Return at most 40 commits in default JSON while preserving the full filtered count. Build author counts from the full filtered set. Set `truncated` when more commits exist than are included. For every returned commit, list each candidate branch whose tip contains it. Include every branch with pending qualifying commits in `pending.branches`, together with its state and full pending count; do not silently omit a branch merely because the commit list was truncated.

### Advancing markers

When `--mark` or `--skip` has no explicit revision, prefer the tips captured in `state.pending`. New commits that arrive after the notice must remain pending. If no captured tips exist, use the current candidate tips.

With an explicit revision, verify `<revision>^{commit}` before storing it. Keep old live markers that are not ancestors of a newly marked tip. Clear pending state, update `reviewedAt`, and append a bounded history entry containing the action and marked tips.

This step is complete when branch switches, divergent markers, new commits arriving after a notice, malformed state, and a repository with no commits all produce the specified state transitions without uncaught errors.

## 4. Add a harness adapter

Keep target-specific code in a small adapter or hook command. Its only jobs are:

1. Read the discovered event payload if the harness supplies one.
2. Resolve the project directory and pass it as `COMMIT_RECAP_PROJECT_DIR`.
3. Invoke the scanner in default mode; this invocation performs the fetch.
4. Treat empty stdout as a successful no-op.
5. Parse and validate the scanner's JSON.
6. Map `notice`, branch data, and pending commits into channels supported by the harness.
7. Tell the acting agent that its first response must directly mention the available recap.
8. Exit 0 when scanning, parsing, or notification fails, unless the harness has a documented non-blocking error mechanism.

If the harness supports private context, place the pending data plus the recap protocol from step 6 there. Use visible hook output only when private context cannot carry the instruction. The required user-facing signal is a sentence in the acting agent's first response, not an easy-to-miss startup log line. If the harness supports only visible text, print `notice`; the agent can retrieve details later with `--list`.

Do not make the adapter emit another agent's response schema. Do not include a model name, vendor home directory, or repository-specific commit policy.

The adapter is complete when the same scanner output can be translated by changing only the adapter.

## 5. Register the session hook

Register the adapter on the session-start event discovered in step 1. Use a quoted absolute path. Set environment variables in the hook configuration or wrapper instead of editing the scanner for one installation.

A generic command looks like this:

```text
COMMIT_RECAP_PROJECT_DIR="<project directory from this event>" node "/absolute/path/to/project/hooks/commit-recap-adapter.mjs"
```

If the harness starts commands in the repository root and supplies no project placeholder, let the adapter use its working directory. Keep one registration only. Choose a timeout that covers the scanner's Git timeouts without delaying session startup indefinitely.

Registration is complete when the harness reloads the configuration, starts a session inside a repository, invokes the adapter once, and reports no hook-format error.

## 6. Define the recap protocol

Give the acting agent these instructions through private hook context, a project instruction, or the user's explicit reference to this recipe:

1. In the first response of the session, directly state that a recap is available and summarize its size, including both commit and branch counts. Do this even when the user's first request is unrelated, but keep it to one sentence and do not repeat it later.
2. Do not produce the full recap merely because pending work exists; continue with the user's request unless they ask for the recap.
3. When the user requests the recap, run `--list` to obtain the current pending branches and commits.
4. Inspect every listed commit with `git show`, including the full commit message and diff statistics.
5. For each branch, explain whether it is current, ahead, behind, diverged, in sync, untracked, or remote-only, and identify the pending commits associated with it.
6. For each commit, explain what changed and report the rationale stated in the commit body. Say plainly when no rationale is present. Do not invent one from the diff.
7. After delivering the recap, run `--mark` without a revision so the scanner uses the tips captured when it notified the user.
8. If the user explicitly dismisses the recap, run `--skip` instead.
9. Do not mark or skip when recap generation fails partway through.

Use the same absolute scanner path for `--list`, `--mark`, `--skip`, `--status`, and `--reset`.

The protocol is complete when a different model or harness can follow it without any vendor-specific vocabulary or configuration knowledge.

## 7. Test the whole path

Use temporary Git repositories and deterministic author identities. Cover these cases:

1. Outside a Git repository, default mode exits 0 with no output.
2. A fresh repository with no commits exits 0 with no output.
3. Another human author's non-merge commit appears in default JSON.
4. The configured user's commits, merge commits, and bot commits are excluded.
5. A commit on a non-default local branch and a commit on a non-default remote branch both appear.
6. Branch membership and the `ahead`, `behind`, `diverged`, `in-sync`, `untracked`, and `remote-only` states are correct.
7. More than 40 qualifying commits sets `truncated` while preserving full commit and per-branch totals.
8. `--mark` uses captured pending tips, leaving a commit created after the notice pending.
9. Divergent branches retain independent live markers.
10. `--skip` advances coverage and records a different history action from `--mark`.
11. `--reset` clears markers and returns scanning to the lookback window.
12. Malformed state recovers without crashing, and an unwritable state directory returns a controlled error.
13. Every scan mode attempts `git fetch --prune --no-tags <remote>` unless `COMMIT_RECAP_NO_FETCH=1`.
14. Fetch failure still permits a local scan and is visible in `--status`.

Then test the installed integration:

1. Reload the harness.
2. Start a session in a repository with qualifying commits on multiple branches.
3. Make an unrelated first request and confirm that the first assistant response directly mentions the available recap with commit and branch counts, without producing the recap itself.
4. Confirm that later responses do not repeat the offer.
5. Request the recap and verify that every pending branch and commit is covered before marking.
6. Start another session and confirm that reviewed work no longer triggers a recap mention.

The recipe is complete when the direct scanner checks and the real session hook both pass without relying on a particular model, event name, or hook-response schema.

## Troubleshooting

If the scanner reports the user's own commits, inspect `COMMIT_RECAP_ME` and `git config user.email`. If remote commits or branches are missing, check `COMMIT_RECAP_REMOTE`, fetch status, and ref discovery with `--status`. The scanner intentionally fetches on every scan-mode invocation; set `COMMIT_RECAP_NO_FETCH=1` only when the installation must rely on existing refs.

If the scanner works directly but the session shows nothing, inspect the adapter's project directory, command quoting, timeout, and output mapping. If the harness prints raw JSON, the adapter is passing scanner data through instead of translating it. If notices repeat, check for duplicate hook registration and confirm that `--mark` or `--skip` updates the same state directory used by default mode.
