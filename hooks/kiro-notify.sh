#!/bin/bash
# Kiro CLI Stop hook.
#
# Reads Kiro's hook event JSON from stdin, shows a macOS notification, plays a
# sound, and appends a completion record to ~/.kiro/notifications.log.
# Notification hooks must not affect the agent, so this script always exits 0.

set -u

LOG="$HOME/.kiro/notifications.log"
payload=$(cat)

event_name="Stop"
cwd=""
session_id=""
message=""

# Parse known Kiro payload spellings, but still notify if jq is unavailable or
# the payload changes. Stop hooks do not guarantee a user-facing message.
if command -v jq >/dev/null 2>&1 && printf '%s' "$payload" | jq -e . >/dev/null 2>&1; then
  event_name=$(printf '%s' "$payload" | jq -r '.hook_event_name // .trigger // .eventName // "Stop"')
  cwd=$(printf '%s' "$payload" | jq -r '.cwd // ""')
  session_id=$(printf '%s' "$payload" | jq -r '.session_id // .sessionId // ""')
  message=$(printf '%s' "$payload" | jq -r '.message // ""')
fi

[ -n "$event_name" ] || event_name="Stop"
[ -n "$message" ] || message="Kiro finished responding"

project_path=${cwd:-$PWD}
project_path=${project_path%/}
project=$(basename "$project_path")
[ -n "$project" ] || project="Kiro session"

# Logging failures must never interfere with Kiro.
mkdir -p "$(dirname "$LOG")" 2>/dev/null
printf '%s\t%s\t%s\t%s\t%s\n' \
  "$(date '+%Y-%m-%d %H:%M:%S')" "$event_name" "$project" "$session_id" "$message" \
  >>"$LOG" 2>/dev/null

# Keep the log bounded: after roughly 1 MB, retain its most recent 500 lines.
if [ -f "$LOG" ] && [ "$(wc -c <"$LOG" 2>/dev/null || echo 0)" -gt 1000000 ]; then
  tail -n 500 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null
fi

# Escape values embedded in AppleScript string literals and cap their length.
esc() {
  printf '%s' "$1" \
    | tr '\n\r\t' '   ' \
    | cut -c1-200 \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

body=$(esc "$message")
if [ -n "$session_id" ]; then
  subtitle=$(esc "${project} - session ${session_id:0:12}")
else
  subtitle=$(esc "$project")
fi

# Playing the sound directly also works when the terminal lacks notification
# permission. Both commands are best-effort and intentionally silent.
afplay "/System/Library/Sounds/Glass.aiff" >/dev/null 2>&1 &
osascript -e "display notification \"${body}\" with title \"Kiro CLI\" subtitle \"${subtitle}\"" >/dev/null 2>&1

exit 0
