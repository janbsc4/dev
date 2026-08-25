# Recipe: Kiro CLI in T3 Code

Status: **BETA**. On 2026-08-22, T3 Code v0.0.33 and its `main` branch do not ship a Kiro or generic ACP provider. The current experiment uses an open, blocked pull request. Recheck upstream before using it.

This recipe connects Kiro CLI to T3 Code through the Agent Client Protocol. It prefers released support when available. Until then, it keeps the experimental T3 build and its state separate from the released app.

Do not set a Cursor provider's binary path to `kiro-cli`. T3's Cursor driver sends Cursor-specific authentication and extension requests that Kiro does not implement.

## Result

- Kiro CLI is installed, authenticated, and reachable through an absolute path.
- The selected T3 build contains either a native Kiro driver or the generic `acpRegistry` driver.
- T3 launches Kiro as `<absolute-kiro-path> acp`, optionally followed by `--agent <name>`.
- The provider configuration leaves the ACP authentication method empty.
- An experimental build uses its own source directory and T3 home directory. It does not change `~/.t3/userdata/settings.json`.
- A T3 thread proves the working directory, read access, approval handling, file writes, and a second turn.
- The final report records versions, paths, the T3 commit, validation results, limitations, and rollback instructions.

## 1. Recheck upstream support

Do not assume the dated status above is still current. Inspect the latest release and the driver registry before installing or editing anything:

```bash
gh release view --repo pingdotgg/t3code \
  --json tagName,publishedAt,targetCommitish,url

T3_RELEASE_REF="$(gh release view --repo pingdotgg/t3code \
  --json tagName --jq '.tagName')"

gh api -H "Accept: application/vnd.github.raw+json" \
  "repos/pingdotgg/t3code/contents/apps/server/src/provider/builtInDrivers.ts?ref=${T3_RELEASE_REF}"

gh pr view 6071 --repo pingdotgg/t3code \
  --json state,isDraft,mergeStateStatus,headRefOid,updatedAt,url

gh pr view 5968 --repo pingdotgg/t3code \
  --json state,isDraft,mergeStateStatus,headRefOid,updatedAt,url
```

If `gh` is unavailable, inspect the release, driver registry, and pull requests through the source links at the end of this recipe. Do not install `gh` only for this check.

Choose one route:

1. If a released build registers `KiroDriver`, follow that release's Kiro documentation. Do not apply the experimental `acpRegistry` settings shape to a native driver.
2. If a released build registers `AcpRegistryDriver`, use the released generic ACP route. Confirm that its current configuration still accepts `command`, `launchArgs`, and an optional `authMethodId`.
3. If neither driver is released, explain that stable T3 cannot run Kiro. Ask whether the user accepts an unmerged source build before continuing to the experimental route.

Do not treat a closed pull request as released support. Confirm that its code appears in a tagged release's `builtInDrivers.ts`.

This step is complete when the selected route is backed by a tagged source file, or the user has explicitly accepted the experimental source build and its current check status.

## 2. Prepare Kiro CLI

Find the real executable and inspect its ACP command:

```bash
KIRO_BIN="$(command -v kiro-cli || true)"
test -n "$KIRO_BIN"
test -x "$KIRO_BIN"
"$KIRO_BIN" --version
"$KIRO_BIN" acp --help
```

Use the absolute value of `KIRO_BIN` in T3. Shell aliases and functions are not executable paths.

If Kiro CLI is missing, show the user the official installer and ask before running it:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

After installation, resolve `KIRO_BIN` again. Do not install Kiro CLI through Homebrew. Kiro's installation documentation does not support that route.

Check authentication on the machine that will run T3:

```bash
"$KIRO_BIN" whoami
```

If that fails, run `"$KIRO_BIN" login` and let the user finish the browser or device flow. Run `whoami` again before continuing. Do not copy credentials into T3 settings.

Ask whether T3 should use Kiro's default agent or a named custom agent. For a named agent, verify that its definition exists in one of these locations:

```text
<project>/.kiro/agents/<name>.json
<project>/.kiro/agents/<name>.md
~/.kiro/agents/<name>.json
~/.kiro/agents/<name>.md
```

Use one of these launch argument strings:

```text
acp
acp --agent <name>
```

Do not add `--trust-all-tools`. Start with approval prompts intact.

A bare `kiro-cli acp` process waits for JSON-RPC on standard input. Silence after launch is normal, not a health check. `kiro-cli acp --help` and the end-to-end T3 test are the useful checks.

This step is complete when `KIRO_BIN` is absolute and executable, `whoami` succeeds, `acp --help` lists the ACP command, and the launch argument string is recorded.

## 3. Prepare T3 Code

### Released route

Install or update the released app only with the user's approval. On macOS, the official package is:

```bash
# New installation:
brew install --cask t3-code

# Existing installation:
brew upgrade --cask t3-code
```

Before writing provider settings, confirm the released source still uses the fields selected in step 1. The normal desktop settings file is:

```text
~/.t3/userdata/settings.json
```

Stop T3 before editing that file. Make a timestamped backup, preserve every unrelated setting, and refuse to replace an existing provider instance with the same ID unless the user approves the exact replacement.

Continue to step 4 with the released settings path.

### Experimental route for the current upstream state

The inspected fallback is [T3 Code PR #6071](https://github.com/pingdotgg/t3code/pull/6071), pinned here at commit `bba5635a02bfea5d93d8425d7afb6ff8636a9c68`. On 2026-08-22, the PR was open, blocked, and had failing checks. Report its current state and ask for explicit approval before cloning it or installing its dependencies.

Ask the user to choose two unused absolute paths:

```text
T3_SOURCE=<directory for the source checkout>
T3_HOME=<directory for isolated T3 state>
```

Reject `T3_HOME=~/.t3`. The point of this route is to leave the released app's state alone.

Confirm that the PR still points at the pinned commit:

```bash
PINNED_T3_SHA="bba5635a02bfea5d93d8425d7afb6ff8636a9c68"
CURRENT_T3_SHA="$(gh pr view 6071 --repo pingdotgg/t3code \
  --json headRefOid --jq '.headRefOid')"
printf 'Pinned:  %s\nCurrent: %s\n' "$PINNED_T3_SHA" "$CURRENT_T3_SHA"
test "$CURRENT_T3_SHA" = "$PINNED_T3_SHA"
```

If the head changed, inspect the new diff and checks. Do not silently replace the pin.

The pinned checkout requires Node 24 and Vite+. Verify the active toolchain:

```bash
node --version
vp --version
```

Use Node `24.13.1` or a later Node 24 release. If `vp` is missing, show the official Vite+ installer and ask before running it:

```bash
curl -fsSL https://vite.plus | bash
```

Clone and detach at the approved commit:

```bash
git clone https://github.com/pingdotgg/t3code.git "$T3_SOURCE"
git -C "$T3_SOURCE" fetch origin \
  "pull/6071/head:refs/remotes/origin/pr-6071"
git -C "$T3_SOURCE" switch --detach "$PINNED_T3_SHA"
test "$(git -C "$T3_SOURCE" rev-parse HEAD)" = "$PINNED_T3_SHA"
```

Refuse to clone over an existing path. If the user wants to reuse a checkout, inspect its status, remotes, and uncommitted work before changing it.

Install the locked dependencies and run the branch checks from `T3_SOURCE`:

```bash
vp i
vp run typecheck
vp run test
```

Stop if dependency installation, type checking, or tests fail. Do not hide failures or bypass repository hooks and checks.

This step is complete when the chosen released build contains a compatible driver, or the experimental checkout is pinned to the approved SHA and its local type checks and tests pass.

## 4. Add the Kiro provider

For a generic ACP driver, use these values:

```text
Instance ID: kiro
Display name: Kiro CLI
Driver: acpRegistry
Command: <absolute value of KIRO_BIN>
Launch arguments: acp
Authentication method ID: <empty>
```

For a named Kiro agent, set launch arguments to `acp --agent <name>`.

The experimental route can create the provider from the terminal. Keep T3 stopped, export the approved paths, and run this merge script. It creates a backup when the settings file already exists and refuses to replace a different `kiro` instance.

```bash
export T3_HOME="<isolated-t3-home>"
export KIRO_BIN="<absolute-path-to-kiro-cli>"
export KIRO_AGENT=""
export SETTINGS_FILE="$T3_HOME/userdata/settings.json"

python3 <<'PY'
import datetime
import json
import os
import pathlib
import re
import shutil
import stat
import tempfile

settings_path = pathlib.Path(os.environ["SETTINGS_FILE"]).expanduser()
kiro_bin = pathlib.Path(os.environ["KIRO_BIN"]).expanduser()
agent = os.environ.get("KIRO_AGENT", "").strip()

if not kiro_bin.is_absolute() or not os.access(kiro_bin, os.X_OK):
    raise SystemExit(f"KIRO_BIN is not an absolute executable: {kiro_bin}")
if agent and not re.fullmatch(r"[A-Za-z0-9._-]+", agent):
    raise SystemExit("KIRO_AGENT must use letters, digits, dot, underscore, or hyphen")

launch_args = "acp" if not agent else f"acp --agent {agent}"
desired = {
    "driver": "acpRegistry",
    "displayName": "Kiro CLI",
    "enabled": True,
    "config": {
        "command": str(kiro_bin),
        "launchArgs": launch_args,
    },
}

settings_path.parent.mkdir(parents=True, exist_ok=True)
if settings_path.exists():
    try:
        settings = json.loads(settings_path.read_text())
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON in {settings_path}: {error}") from error
    if not isinstance(settings, dict):
        raise SystemExit(f"Expected a JSON object in {settings_path}")
else:
    settings = {}

instances = settings.setdefault("providerInstances", {})
if not isinstance(instances, dict):
    raise SystemExit("providerInstances is not a JSON object")
existing = instances.get("kiro")
if existing is not None and existing != desired:
    print(json.dumps(existing, indent=2))
    raise SystemExit("A different 'kiro' provider exists; review it before replacing it")
instances["kiro"] = desired

backup_path = None
mode = 0o600
if settings_path.exists():
    mode = stat.S_IMODE(settings_path.stat().st_mode)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup_path = settings_path.with_name(f"{settings_path.name}.bak-{stamp}")
    shutil.copy2(settings_path, backup_path)

fd, temporary_name = tempfile.mkstemp(
    prefix=f".{settings_path.name}.", dir=settings_path.parent
)
try:
    with os.fdopen(fd, "w") as temporary_file:
        json.dump(settings, temporary_file, indent=2, sort_keys=True)
        temporary_file.write("\n")
    os.chmod(temporary_name, mode)
    os.replace(temporary_name, settings_path)
except BaseException:
    if os.path.exists(temporary_name):
        os.unlink(temporary_name)
    raise

print(f"Wrote {settings_path}")
if backup_path:
    print(f"Backup: {backup_path}")
print(json.dumps(desired, indent=2))
PY
```

Read the resulting provider entry back from `SETTINGS_FILE`. Confirm that `command` is the expected absolute path, `launchArgs` is correct, and no secrets were added.

For a future released generic ACP build, use the same merge only after checking its current schema and backing up the production settings file. A native Kiro driver may use different field names. Follow its tagged documentation instead.

This step is complete when the settings file contains one reviewed Kiro provider and every unrelated setting remains semantically unchanged.

## 5. Start T3 and validate the connection

For the experimental route, start the desktop development stack from `T3_SOURCE` with the isolated home:

```bash
vp run dev:desktop --home-dir "$T3_HOME"
```

Run it as a background process when the terminal agent supports background commands. Surface the startup output and keep the process handle. Treat the printed ports and state path as authoritative.

For a released route, start the released T3 app after its settings update. Confirm from its logs or provider status that the `kiro` instance resolves to the expected driver. An `unavailable` provider means that build does not contain the configured driver.

Create a disposable Git repository and print its path:

```bash
SMOKE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kiro-t3-smoke.XXXXXX")"
git -C "$SMOKE_DIR" init -q
printf '# Kiro T3 ACP smoke test\n' > "$SMOKE_DIR/README.md"
git -C "$SMOKE_DIR" add README.md
git -C "$SMOKE_DIR" \
  -c user.name="Kiro T3 smoke test" \
  -c user.email="kiro-t3-smoke@example.invalid" \
  commit -q -m "Initialize smoke test"
printf '%s\n' "$SMOKE_DIR"
```

Use T3 Code to start a Kiro thread for that exact project path. Select the most restrictive supervised mode available. Run these checks in order:

1. Send this read-only prompt:

   ```text
   Read README.md and reply with its exact first line. Do not modify files and do not use the network.
   ```

   The response must be `# Kiro T3 ACP smoke test`.

2. Send this write prompt:

   ```text
   Create acp-approved.txt in the project root with exactly this one line:
   approved through Kiro ACP
   Do not change any other file.
   ```

   T3 must surface a permission request before the write. Approve it once, then verify from the terminal:

   ```bash
   test "$(cat "$SMOKE_DIR/acp-approved.txt")" = "approved through Kiro ACP"
   git -C "$SMOKE_DIR" status --short
   ```

   The status output must list only `acp-approved.txt` as untracked.

3. Send a second-turn prompt in the same thread:

   ```text
   Without reading the filesystem again, name the file you created in the previous turn.
   ```

   The answer must name `acp-approved.txt`. This checks that T3 keeps the ACP session for later turns.

If the write happens without an approval request, stop. Do not compensate by adding `--trust-all-tools`. Inspect the T3 driver and Kiro permission mapping before using the integration on a real repository.

Inspect Kiro's macOS log only when a check fails:

```text
$TMPDIR/kiro-log/kiro-chat.log
```

Do not claim success from a provider health indicator alone. The recipe is complete only after all three thread checks pass and the exact T3 commit, Kiro version, settings path, and smoke repository path are recorded.

## 6. Report and rollback

Report:

- T3 release or source commit
- T3 pull request state when checked
- Kiro CLI version and absolute binary path
- Kiro launch arguments, without credentials
- T3 settings path and backup path
- local type-check and test results for a source build
- all three end-to-end results
- any ignored Kiro ACP extensions or missing T3 features

The generic ACP proposal does not provide T3's provider-backed commit message, pull request text, branch name, or thread title generation. Kiro-specific ACP extensions may also be ignored. State these limits rather than presenting the experiment as equivalent to a native provider.

For the experimental route, stop the development process first. Because its state is isolated, rollback means retaining or deleting only the exact `T3_SOURCE`, `T3_HOME`, and `SMOKE_DIR` paths that were reported. Ask before recursively deleting any of them.

For a released route, stop T3 and restore the timestamped settings backup, or remove only `providerInstances.kiro` with another parse-and-merge operation. Do not overwrite the settings file with a hand-written partial object.

## Troubleshooting

### T3 marks `kiro` unavailable

The running T3 build does not register the configured driver. Check its exact commit and `builtInDrivers.ts`. Stable v0.0.33 cannot load `acpRegistry`.

### ACP fails on `authenticate`

Confirm that the authentication method ID is empty. This also happens when Kiro is configured as Cursor, because the released Cursor driver forces `cursor_login`. Use the generic ACP or native Kiro driver instead.

### T3 cannot find Kiro CLI

Run `command -v kiro-cli` in a login shell and store that absolute path. Restart T3 after correcting it. Do not use an alias, shell function, or command containing pipes and redirects.

### Kiro starts but appears idle

An ACP process waits for newline-delimited JSON-RPC on standard input. Test through T3 or an ACP client. Do not expect an interactive prompt from `kiro-cli acp`.

### Authentication fails at session start

Run `"$KIRO_BIN" whoami` in the same account and environment that starts T3. If needed, run `"$KIRO_BIN" login` outside T3 and retry.

### Models are missing during the provider probe

The proposed generic driver allows model discovery to fail without disabling the provider. Start the smoke thread before adding custom model IDs. Do not guess model names.

### T3 rewrites or loses the provider entry

Confirm that T3 was stopped during the edit and that the edited path matches the active `--home-dir`. For an explicit home, the settings file is `<home>/userdata/settings.json`.

### The pinned PR no longer checks out

Recheck the pull request and tagged releases. If the code merged, move to the released route. If the pull request changed or closed unmerged, do not fetch a random fork as a substitute.

## Sources checked on 2026-08-22

- [Kiro CLI installation](https://kiro.dev/docs/getting-started/installation.md)
- [Kiro CLI authentication](https://kiro.dev/docs/getting-started/authentication.md)
- [Kiro CLI ACP documentation](https://kiro.dev/docs/cli/acp.md)
- [T3 Code v0.0.33](https://github.com/pingdotgg/t3code/releases/tag/v0.0.33)
- [T3 v0.0.33 built-in driver registry](https://github.com/pingdotgg/t3code/blob/3b72d17cbca691f0b64e6d4a10c9e349f42873a5/apps/server/src/provider/builtInDrivers.ts)
- [Generic ACP pull request #6071](https://github.com/pingdotgg/t3code/pull/6071)
- [Generic ACP user documentation at the inspected PR commit](https://github.com/pingdotgg/t3code/blob/bba5635a02bfea5d93d8425d7afb6ff8636a9c68/docs/user/providers-acp.md)
- [T3 source-build commands at the inspected PR commit](https://github.com/pingdotgg/t3code/blob/bba5635a02bfea5d93d8425d7afb6ff8636a9c68/docs/internals/scripts.md)
- [Dedicated Kiro provider pull request #5968](https://github.com/pingdotgg/t3code/pull/5968)
