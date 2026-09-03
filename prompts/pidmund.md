---
description: Install pidmund and/or ompidmund, commands that open the most recent assistant response from a pi or omp chat session in the Edmund Markdown editor
---
Install one or both of these commands, which open the most recent assistant response from a coding-agent chat session in Edmund, the Markdown editor app for macOS:

- `pidmund` reads pi sessions from `~/.pi/agent/sessions`
- `ompidmund` reads omp sessions from `~/.omp/agent/sessions`

Run it once per machine.

Ask the user at the start which to install: `pidmund`, `ompidmund`, or both. Then apply every step below to each selected command. When the steps say "the script" or "the command", they mean each selected one.

## Result

The finished setup must:

- find each selected script in this repository (`scripts/pidmund`, `scripts/ompidmund`) by absolute canonical path
- verify the prerequisites: macOS, `jq`, the CLI of each selected agent, and Edmund in `/Applications`
- install each selected script under its own name into a directory that is already on the user's `PATH`
- prefer `~/.local/bin` when it exists and is on the `PATH`, otherwise ask where to install
- use a symbolic link when the repository is in a permanent location so edits to the clone take effect; otherwise copy the file
- verify that `command -v <name>` resolves to the installed script for each installed command
- report the exact rollback command for each installed link or copy

## 1. Resolve the source scripts

Find the repository root with Git or from this template's location, then resolve `<repository>/scripts/<name>` to an absolute canonical path for each selected script. Check that each file is readable and executable.

Confirm that the clone is in a permanent location. A symbolic link into a temporary checkout breaks when the repository moves or is deleted.

This step is complete when you have the absolute source path of every selected script.

## 2. Check prerequisites

Verify each of these and tell the user about any that are missing before continuing:

- macOS: `uname` must report `Darwin`, because the scripts use `open -a`
- `jq` must be findable with `command -v jq`
- for `pidmund`: pi session storage must exist at `~/.pi/agent/sessions`
- for `ompidmund`: omp session storage must exist at `~/.omp/agent/sessions`
- Edmund must be installed at `/Applications/Edmund.app`

## 3. Choose the install directory

Look through the user's `PATH` for a writable directory. If `~/.local/bin` is on the `PATH`, use it. Otherwise list the writable `PATH` directories and ask the user to pick one, or offer to add a new directory to their shell profile.

Use the same directory for all selected commands unless the user asks otherwise.

## 4. Install

For each selected script, create a symbolic link from the chosen directory to the source script:

```bash
ln -s <source> <install-dir>/<name>
```

If the repository is not in a permanent location, copy the file instead of linking and make sure it is executable.

## 5. Verify

Run `command -v <name>` for each installed command and confirm it prints a path. Then run it from a directory that has a session of the matching agent and confirm the response opens in Edmund.

Report the rollback command for each installed command, which is `rm <install-dir>/<name>` for a link or copy.
