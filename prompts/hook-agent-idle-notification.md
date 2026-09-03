---
description: Add a macOS desktop notification and sound when a command-line coding agent finishes a response
---
Add a desktop notification when a command-line coding agent finishes a response. The agent's hook format may differ, so discover and use its native completion event rather than copying configuration from another agent.

## Result

The finished hook must:

- run once after the agent finishes a response, not during retries, compaction, or queued follow-up messages
- display a macOS notification titled with the agent name
- play the built-in Glass sound
- tolerate missing or malformed input from the harness
- produce no terminal output or log files
- exit with status 0 even when notification delivery fails

## 1. Find the agent's hook contract

Inspect the agent's local documentation, help output, or existing configuration. Identify:

1. The event that fires after a response or turn completes. It may be named `Stop`, `Notification`, `post-response`, `agent_end`, `agent_settled`, or something similar. Some harnesses distinguish "the run ended" from "the agent is idle"; the former can fire again during auto-retry, compaction, or queued follow-up messages. Prefer the truly idle event when one exists.
2. Where project-level hooks belong.
3. How a hook integrates: a command action in a configuration file, or an extension/plugin module that must spawn a command itself. Some harnesses have no shell-hook mechanism at all and require the latter.
4. How the notifier receives context: JSON on stdin, environment variables, command arguments, or values available only inside the harness's own adapter (such as a working-directory field on a context object). Not every harness sends JSON on stdin.
5. Which directory the command runs from, and whether handlers must return quickly to avoid blocking the agent's idle state.

Prefer a project-level hook. Use an absolute script path if the runner's working directory is uncertain. Merge the hook into existing configuration instead of replacing that configuration.

This step is complete when the event name, configuration path, integration format, and context channel are known.

## 2. Create the notifier

Create `hooks/agent-notify.sh` in the project as the shared core. It must work no matter which integration format step 1 found: command hooks run it directly with JSON on stdin; adapters spawn it and pass context through environment variables such as `AGENT_CWD`.

```bash
#!/bin/bash
# Best-effort macOS notification for an agent completion hook.

set -u

payload=$(cat)
title="${AGENT_NAME:-Coding agent}"
message="${AGENT_NOTIFICATION_MESSAGE:-Agent finished responding}"
cwd="${AGENT_CWD:-}"

# Common fields are optional. The notification still works without jq or JSON.
if command -v jq >/dev/null 2>&1 && printf '%s' "$payload" | jq -e . >/dev/null 2>&1; then
  parsed_message=$(printf '%s' "$payload" | jq -r '.message // ""')
  cwd=$(printf '%s' "$payload" | jq -r '.cwd // ""')
  [ -n "$parsed_message" ] && message="$parsed_message"
fi

project_path=${cwd:-$PWD}
project_path=${project_path%/}
project=$(basename "$project_path")
[ -n "$project" ] || project="Agent session"

# Escape untrusted values before embedding them in AppleScript literals.
esc() {
  printf '%s' "$1" \
    | tr '\n\r\t' '   ' \
    | cut -c1-200 \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

body=$(esc "$message")
notification_title=$(esc "$title")
subtitle=$(esc "$project")

afplay "/System/Library/Sounds/Glass.aiff" >/dev/null 2>&1 &
osascript -e "display notification \"${body}\" with title \"${notification_title}\" subtitle \"${subtitle}\"" >/dev/null 2>&1

exit 0
```

Make it executable:

```bash
chmod +x "/absolute/path/to/project/hooks/agent-notify.sh"
```

The script is complete when `bash -n hooks/agent-notify.sh` exits with status 0 and the file is executable.

## 3. Register the hook

Attach the script to the event found in step 1 using the integration format found there.

- **Command hooks:** add one command action to the completion event in the configuration file.
- **Extension or plugin formats:** write a small adapter module in the harness's native format that listens on the completion event and spawns the script detached with all streams ignored, so the handler returns immediately and the agent's idle state is never delayed. Pass the working directory and agent name through environment variables if the harness has no stdin payload. Keep the script itself unchanged.

Identify the caller by setting `AGENT_NAME`:

```text
AGENT_NAME="Your agent name" bash "/absolute/path/to/project/hooks/agent-notify.sh"
```

Quote the path. Keep the hook non-blocking if the agent supports that option. Do not attach it to tool-use events, since that creates a notification for every tool call. Guard against events that can fire more than once per response, for example by checking that the agent is idle before spawning.

Registration is complete when the agent loads the configuration without an error and resolves the integration to the new script.

## 4. Test the whole path

First, invoke the script directly the way the adapter will:

```bash
# With JSON on stdin:
printf '%s\n' '{"cwd":"/absolute/path/to/project","message":"Agent finished responding"}' \
  | AGENT_NAME="Test agent" bash "/absolute/path/to/project/hooks/agent-notify.sh"

# Or with environment variables when the harness has no stdin payload:
AGENT_NAME="Test agent" AGENT_CWD="/absolute/path/to/project" \
  bash "/absolute/path/to/project/hooks/agent-notify.sh"
```
```

Confirm that:

- the command exits with status 0
- macOS plays the Glass sound
- a notification appears with `Test agent` as its title
- the project directory name appears as its subtitle
- the script creates no log file

Then restart or reload the agent if hook changes require it. Submit a trivial prompt and wait for the response to finish. Exactly one notification should appear.

The work is complete when both the direct test and the real completion event produce one notification without changing the agent's response or exit status.

## Troubleshooting

If the sound works but no banner appears, allow notifications for the terminal application in macOS System Settings. If nothing happens, run the registered command directly and check its path and quoting. If notifications repeat, the event fires more than once per response or the hook is registered more than once; prefer the harness's idle event or add an idle check. If notifications arrive while the agent is still working, the wrong event is attached.
