#!/usr/bin/env bash
# Phase 2B / V-32: native macOS capture of the Inkdrop window (composited by the window server,
# including the acrylic blending with the controlled backdrop), plus the matching computed styles.
#
# usage: inkdrop-v32-capture.sh <theme> <id> <gray|pattern> <editor|preview> <active|inactive> <acrylic|opaque> <scratch_dir>
#
# Fixed geometry (screen points, top-left origin):
#   Inkdrop window 1200x700 at (400, 250); backdrop 1400x900 at (300, 150) directly behind it.
# Requires: Inkdrop running with --remote-debugging-port=9334 (127.0.0.1), the test note shown,
# the backdrop binary compiled from backdrop.swift at <scratch_dir>/bin/backdrop, and screen-recording
# permission already granted by the user (this script never touches privacy settings).
set -euo pipefail
theme="$1"; id="$2"; bg="$3"; state="$4"; focus="$5"; label="$6"; tmp="$7"
here="$(cd "$(dirname "$0")" && pwd)"
ev="$(cd "$here/.." && pwd)"
export CDP_URL_PREFIX="file:///Applications/Inkdrop.app"
cdp() { node "$here/cdp.mjs" 9334 "$@"; }
with() { printf '%s\n' "$1" > "$tmp/with.js"; cat "$2" >> "$tmp/with.js"; echo "$tmp/with.js"; }
name="$id-v32-$label-$bg-$state-$focus"

cdp eval "$(with "window.__P2B_THEME = \"$theme\";" "$here/inkdrop-select-theme.js")" > /dev/null
cdp eval "$here/inkdrop-editor-chrome-off.js" > /dev/null
cdp eval "$(with "window.__P2B_STATE = \"$([ "$state" = preview ] && echo preview || echo reset)\";" "$here/inkdrop-state.js")" > /dev/null
cdp eval "$here/inkdrop-window-geometry.js" > /dev/null

# Backdrop behind the window; for the inactive capture the backdrop app takes focus (it stays below Inkdrop).
"$tmp/bin/backdrop" "$bg" 300 150 1400 900 $([ "$focus" = inactive ] && echo activate) &
bpid=$!
sleep 1
if [ "$focus" = active ]; then osascript -e 'tell application "Inkdrop" to activate'; fi
sleep 2.5

cdp eval "$here/probe-inkdrop.js" > "$tmp/probe-before.json"
shot="$ev/inkdrop/$name.png"
/usr/sbin/screencapture -x -R400,250,1200,700 "$shot"
shot_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cdp eval "$here/probe-inkdrop.js" > "$tmp/probe-after.json"
kill "$bpid"; wait "$bpid" 2>/dev/null || true

# One JSON per capture: capture metadata + the probe taken right before and right after the shot.
python3 -I - "$tmp/probe-before.json" "$tmp/probe-after.json" "$shot" "$shot_time" "$bg" "$focus" "$label" \
  > "$ev/measurements/inkdrop-$name.json" <<'EOF'
import hashlib, json, subprocess, sys
before, after, shot, t, bg, focus, label = sys.argv[1:8]
dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", shot], capture_output=True, text=True).stdout.split()
print(json.dumps({
    "capture": {
        "method": "/usr/sbin/screencapture -x -R400,250,1200,700 (native window-server composite, display colour space)",
        "capturedAt": t, "file": shot.split("/evidence/phase2-p0/")[-1],
        "pixels": [int(dims[dims.index("pixelWidth:") + 1]), int(dims[dims.index("pixelHeight:") + 1])],
        "sha256": hashlib.sha256(open(shot, "rb").read()).hexdigest(),
        "windowRectPoints": [400, 250, 1200, 700], "backdrop": bg, "backdropRectPoints": [300, 150, 1400, 900],
        "requestedFocus": focus, "acrylicLabel": label,
    },
    "probeBeforeShot": json.load(open(before)),
    "probeAfterShot": json.load(open(after)),
}, indent=1))
EOF
python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); b=d['probeBeforeShot']['bodyClasses']; a=d['probeAfterShot']['bodyClasses']; print(sys.argv[2], 'blurred before/after:', 'is-blurred' in b, 'is-blurred' in a, '| acrylic:', 'acrylic-window' in b)" "$ev/measurements/inkdrop-$name.json" "$name"
