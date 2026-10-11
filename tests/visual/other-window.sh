#!/usr/bin/env bash
# V-38: hide / show the window of the app that is NOT being captured, so it can never sit between the
# captured window and the controlled backdrop (both apps use the same 1200x700 rectangle). Only the
# isolated Obsidian (127.0.0.1:9333) and the Inkdrop started for V-38 (127.0.0.1:9334) are addressed,
# through their own DevTools endpoints; the user's regular Obsidian is never touched. A missing endpoint
# is not an error (that app is simply not running).
#
# usage: bash tests/visual/other-window.sh <hide|show> <obsidian|inkdrop>
set -euo pipefail
action="$1"; app="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cdp="$root/research/evidence/phase2-p0/tools/cdp.mjs"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if [ "$app" = obsidian ]; then
  port=9333; prefix="app://obsidian.md"
  [ "$action" = hide ] && js='(() => { electronWindow.hide(); return 1; })()' || js='(() => { electronWindow.showInactive(); return 1; })()'
else
  port=9334; prefix="file:///Applications/Inkdrop.app"
  [ "$action" = hide ] && js='(() => { inkdrop.window.hide(); return 1; })()' || js='(() => { inkdrop.window.show(); return 1; })()'
fi
curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null || exit 0
printf '%s\n' "$js" > "$tmp/w.js"
CDP_URL_PREFIX="$prefix" node "$cdp" "$port" eval "$tmp/w.js" > /dev/null
sleep 0.5
