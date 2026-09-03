---
description: Install pidmund, a command that opens the most recent assistant response from a pi chat session in the Edmund Markdown editor
---
Install `pidmund`, a one-command way to open the most recent assistant response from a pi chat session in Edmund, the Markdown editor app for macOS.

Run it once per machine.

## Result

The finished setup must:

- find this repository's `scripts/pidmund` script by absolute canonical path
- verify the prerequisites: macOS, `jq`, the pi CLI, and Edmund in `/Applications`
- install the script as `pidmund` into a directory that is already on the user's `PATH`
- prefer `~/.local/bin` when it exists and is on the `PATH`, otherwise ask where to install
- use a symbolic link when the repository is in a permanent location so edits to the clone take effect; otherwise copy the file
- verify that `command -v pidmund` resolves to the installed script
- report the exact rollback command for the installed link or copy

## 1. Resolve the source script

Find the repository root with Git or from this template's location, then resolve `<repository>/scripts/pidmund` to an absolute canonical path. Check that the file is readable and executable.

Confirm that the clone is in a permanent location. A symbolic link into a temporary checkout breaks when the repository moves or is deleted.

This step is complete when you have the absolute source path of the script.

## 2. Check prerequisites

Verify each of these and tell the user about any that are missing before continuing:

- macOS: `uname` must report `Darwin`, because the script uses `open -a`
- `jq` must be findable with `command -v jq`
- pi session storage must exist at `~/.pi/agent/sessions`
- Edmund must be installed at `/Applications/Edmund.app`

## 3. Choose the install directory

Look through the user's `PATH` for a writable directory. If `~/.local/bin` is on the `PATH`, use it. Otherwise list the writable `PATH` directories and ask the user to pick one, or offer to add a new directory to their shell profile.

## 4. Install

Create a symbolic link from the chosen directory to the source script:

```bash
ln -s <source> <install-dir>/pidmund
```

If the repository is not in a permanent location, copy the file instead of linking and make sure it is executable.

## 5. Verify

Run `command -v pidmund` and confirm it prints a path. Then run `pidmund` from a directory that has a pi session and confirm the response opens in Edmund.

Report the rollback command, which is `rm <install-dir>/pidmund` for a link or copy.
