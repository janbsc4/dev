#!/bin/bash
# Claude Code "Notification" hook.
#
# Fires whenever Claude Code notifies the user. Shows a macOS desktop
# notification, plays a sound, and appends a line to ~/.claude/notifications.log
# so a session left running in the background can be caught up on later.
#
# stdin is the hook payload (JSON). Fields used:
#   notification_type  permission_prompt | idle_prompt | auth_success |
#                      elicitation_dialog | elicitation_complete |
#                      elicitation_response | agent_needs_input | agent_completed
#   message            notification text
#   title              optional title
#   cwd                working directory of the session
#
# Notification hooks have no decision control, so this always exits 0: a broken
# notifier must never block or alter the notification itself.

set -u

LOG="$HOME/.claude/notifications.log"

payload=$(cat)

# --- parse (degrade gracefully if jq is unavailable) --------------------------
ntype=""; msg=""; ntitle=""; cwd=""
if command -v jq >/dev/null 2>&1 && printf '%s' "$payload" | jq -e . >/dev/null 2>&1; then
  ntype=$(printf '%s' "$payload" | jq -r '.notification_type // ""')
  msg=$(printf '%s' "$payload" | jq -r '.message // ""')
  ntitle=$(printf '%s' "$payload" | jq -r '.title // ""')
  cwd=$(printf '%s' "$payload" | jq -r '.cwd // ""')
fi
# Anything we could not parse or classify is treated as "unknown" and still
# notifies. Dropping a notification we failed to understand is worse than an
# occasional extra ping.
[ -n "$ntype" ] || ntype="unknown"

[ -n "$msg" ] || msg="${ntitle:-Claude Code needs your attention}"
project=$(basename "${cwd:-$PWD}")

# --- always log ---------------------------------------------------------------
printf '%s\t%s\t%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$ntype" "$project" "$msg" >>"$LOG" 2>/dev/null

# Keep the log from growing without bound: past ~1MB, keep the last 500 lines.
if [ -f "$LOG" ] && [ "$(wc -c <"$LOG" 2>/dev/null || echo 0)" -gt 1000000 ]; then
  tail -n 500 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG" 2>/dev/null
fi

# --- route: which types are worth interrupting for ----------------------------
# Edit these two lists to change what pops up. Anything not listed is log-only.
case "$ntype" in
  permission_prompt|agent_needs_input)  sound="Funk" ;;
  idle_prompt)                          sound="Ping" ;;
  agent_completed)                      sound="Glass" ;;
  elicitation_dialog)                   sound="Tink" ;;
  unknown)                              sound="Ping" ;;
  *)                                    exit 0 ;;   # auth_success, elicitation_complete/response
esac

# --- escape for AppleScript string literals -----------------------------------
# Collapse newlines (illegal in a literal), escape backslashes then quotes,
# and cap the length so a long message cannot overflow the notification.
esc() {
  printf '%s' "$1" \
    | tr '\n\r\t' '   ' \
    | cut -c1-200 \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

body=$(esc "$msg")
subtitle=$(esc "${project}${ntitle:+ - $ntitle}")

# Sound is played directly rather than via `sound name` so it still fires when
# the terminal has not been granted notification permission in System Settings.
afplay "/System/Library/Sounds/${sound}.aiff" >/dev/null 2>&1 &

osascript -e "display notification \"${body}\" with title \"Claude Code\" subtitle \"${subtitle}\"" >/dev/null 2>&1

exit 0
