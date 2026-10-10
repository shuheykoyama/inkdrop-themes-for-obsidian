#!/usr/bin/env bash
# Phase 2B: capture one Inkdrop theme in the documented states (screenshots + computed-style probes).
# usage: inkdrop-capture-theme.sh <theme-name> <short-id> <scratch_dir>
#   Requires Inkdrop running with --remote-debugging-port=9334 --remote-debugging-address=127.0.0.1,
#   the test note already shown (inkdrop-show-test-note.js) and acrylic disabled.
set -euo pipefail
theme="$1"; id="$2"; tmp="$3"
here="$(cd "$(dirname "$0")" && pwd)"
ev="$(cd "$here/.." && pwd)"
export CDP_URL_PREFIX="file:///Applications/Inkdrop.app"
cdp() { node "$here/cdp.mjs" 9334 "$@"; }
with() { printf '%s\n' "$1" > "$tmp/with.js"; cat "$2" >> "$tmp/with.js"; echo "$tmp/with.js"; }

cdp eval "$(with "window.__P2B_THEME = \"$theme\";" "$here/inkdrop-select-theme.js")" > /dev/null
# States 1-3 use Inkdrop's default editor settings (no line numbers, no active-line styling).
cdp eval "$here/inkdrop-editor-chrome-off.js" > /dev/null

# 1. default: editor focused, no selection
cdp eval "$(with 'window.__P2B_STATE = "reset";' "$here/inkdrop-state.js")" > /dev/null
cdp hovershot "$tmp/away.png" 1000 790 1024 800 > /dev/null          # park the mouse away from UI
cdp shot "$ev/inkdrop/$id-1-default.png" 1024 800
CDP_VIEWPORT=1024x800 cdp eval "$here/probe-inkdrop.js" > "$ev/measurements/inkdrop-$id-1-default.json"

# 2. note list focused (accent bar of the selected item)
cdp eval "$(with 'window.__P2B_STATE = "notelist";' "$here/inkdrop-state.js")" > /dev/null
cdp shot "$ev/inkdrop/$id-2-notelist-focus.png" 1024 800
CDP_VIEWPORT=1024x800 cdp eval "$here/probe-inkdrop.js" > "$ev/measurements/inkdrop-$id-2-notelist-focus.json"

# 3. sidebar hover on the "Active" status row (the selected row is "All Notes")
cdp hovershot "$ev/inkdrop/$id-3-sidebar-hover.png" 80 261 1024 800
CDP_VIEWPORT=1024x800 cdp eval "$here/probe-inkdrop-hover.js" > "$ev/measurements/inkdrop-$id-3-sidebar-hover.json"
cdp hovershot "$tmp/away.png" 1000 790 1024 800 > /dev/null

# 4. editor: line numbers + active line enabled temporarily, a word selected
cdp eval "$here/inkdrop-editor-chrome-on.js" > /dev/null
cdp eval "$(with 'window.__P2B_STATE = "editor";' "$here/inkdrop-state.js")" > /dev/null
cdp shot "$ev/inkdrop/$id-4-editor-selection.png" 1024 800
CDP_VIEWPORT=1024x800 cdp eval "$here/probe-inkdrop.js" > "$ev/measurements/inkdrop-$id-4-editor-selection.json"

# 5. preview
cdp eval "$(with 'window.__P2B_STATE = "preview";' "$here/inkdrop-state.js")" > /dev/null
cdp shot "$ev/inkdrop/$id-5-preview.png" 1024 800
CDP_VIEWPORT=1024x800 cdp eval "$here/probe-inkdrop.js" > "$ev/measurements/inkdrop-$id-5-preview.json"
cdp eval "$(with 'window.__P2B_STATE = "reset";' "$here/inkdrop-state.js")" > /dev/null
echo "captured $theme"
