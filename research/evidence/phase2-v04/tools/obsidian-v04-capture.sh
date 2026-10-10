#!/usr/bin/env bash
# V-04: native macOS capture of the isolated Obsidian window (window-server composite, including the
# vibrancy blending with the controlled backdrop), plus the computed styles before and after the shot.
# Same geometry and backdrop as the Inkdrop V-32 captures (../../phase2-p0/tools/inkdrop-v32-capture.sh).
#
# usage: obsidian-v04-capture.sh <case-name> <translucent|opaque> <gray|pattern> <active|inactive> <vault_dir> <scratch_dir>
#
# Fixed geometry (screen points, top-left origin): window 1200x700 at (400, 250); backdrop 1400x900 at (300, 150).
# Requires: the isolated Obsidian instance on 127.0.0.1:9333, the backdrop binary compiled from
# ../../phase2-p0/tools/backdrop.swift at <scratch_dir>/bin/backdrop, and screen-recording permission
# already granted by the user (this script never touches privacy settings).
set -euo pipefail
case_name="$1"; mode="$2"; bg="$3"; focus="$4"; vault="$5"; tmp="$6"
here="$(cd "$(dirname "$0")" && pwd)"
ev="$(cd "$here/.." && pwd)"
cdp() { node "$ev/../phase2-p0/tools/cdp.mjs" 9333 "$@"; }
name="obsidian-${case_name#case-}-$mode-$bg-$focus"

cp "$ev/diagnostic-css/$case_name.css" "$vault/.obsidian/themes/P2B-Diagnostic/theme.css"
{ printf 'window.__V04 = {translucent: %s};\n' "$([ "$mode" = translucent ] && echo true || echo false)"; cat "$here/obsidian-setup.js"; } > "$tmp/setup-with.js"
cdp eval "$tmp/setup-with.js" > /dev/null

# Bring the isolated window to the front first; for the inactive capture the backdrop app then takes
# focus (it stays one level below normal windows, so Obsidian remains in front).
cdp eval "$here/obsidian-focus.js" > /dev/null
"$tmp/bin/backdrop" "$bg" 300 150 1400 900 $([ "$focus" = inactive ] && echo activate) &
bpid=$!
sleep 1.8  # the backdrop activates itself 1 s after start
if [ "$focus" = active ]; then cdp eval "$here/obsidian-focus.js" > /dev/null; else cdp eval "$here/obsidian-raise.js" > /dev/null; fi
sleep 2.5

cdp eval "$here/probe-translucency.js" > "$tmp/probe-before.json"
shot="$ev/screenshots/$name.png"
/usr/sbin/screencapture -x -R400,250,1200,700 "$shot"
shot_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cdp eval "$here/probe-translucency.js" > "$tmp/probe-after.json"
kill "$bpid"; wait "$bpid" 2>/dev/null || true

python3 -I - "$tmp/probe-before.json" "$tmp/probe-after.json" "$shot" "$shot_time" "$bg" "$focus" "$mode" "$case_name" \
  > "$ev/measurements/$name.json" <<'EOF'
import hashlib, json, subprocess, sys
before, after, shot, t, bg, focus, mode, case = sys.argv[1:9]
dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", shot], capture_output=True, text=True).stdout.split()
print(json.dumps({
    "capture": {
        "method": "/usr/sbin/screencapture -x -R400,250,1200,700 (native window-server composite, display colour space)",
        "capturedAt": t, "file": shot.split("/evidence/phase2-v04/")[-1],
        "pixels": [int(dims[dims.index("pixelWidth:") + 1]), int(dims[dims.index("pixelHeight:") + 1])],
        "sha256": hashlib.sha256(open(shot, "rb").read()).hexdigest(),
        "windowRectPoints": [400, 250, 1200, 700], "backdrop": bg, "backdropRectPoints": [300, 150, 1400, 900],
        "requestedFocus": focus, "translucency": mode, "diagnosticCss": f"diagnostic-css/{case}.css",
    },
    "probeBeforeShot": json.load(open(before)),
    "probeAfterShot": json.load(open(after)),
}, indent=1))
EOF
python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); b=d['probeBeforeShot']; a=d['probeAfterShot']; print(sys.argv[2], 'focused before/after:', b['windowFocused'], a['windowFocused'], '| is-translucent:', 'is-translucent' in b['bodyClasses'])" "$ev/measurements/$name.json" "$name"
