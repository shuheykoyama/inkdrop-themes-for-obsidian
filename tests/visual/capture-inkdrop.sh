#!/usr/bin/env bash
# V-38: native macOS capture of Inkdrop under exactly the conditions of tests/visual/capture-obsidian.sh
# (and of V-32, research/11 §15): window 1200x700 pt at (400, 250), controlled backdrop 1400x900 at
# (300, 150) behind it, /usr/sbin/screencapture -x -R400,250,1200,700, PNG. Reuses the V-32 tools in
# research/evidence/phase2-p0/tools without modifying them.
#
# usage: bash tests/visual/capture-inkdrop.sh <theme> <gray|pattern> <active|inactive> <out_dir> <tmp_dir>
# Requires (all set up only after the user's approval, research/14 §6.6):
#   - Inkdrop running with --remote-debugging-port=9334 --remote-debugging-address=127.0.0.1, acrylic on,
#     an existing (not newly created) note shown through tests/visual/inkdrop-show-note (IDs from the user-
#     approved inspection), the editor settings left as the user has them;
#   - the isolated Obsidian (127.0.0.1:9333), if running, is hidden during the shot so it cannot sit
#     between Inkdrop and the backdrop;
#   - screen-recording permission already granted (never changed here).
# Every image must be inspected before it is committed.
set -euo pipefail
theme="$1"; bg="$2"; focus="$3"; out="$4"; tmp="$5"
root="$(cd "$(dirname "$0")/../.." && pwd)"
p2b="$root/research/evidence/phase2-p0/tools"
export CDP_URL_PREFIX="file:///Applications/Inkdrop.app"
cdp() { node "$p2b/cdp.mjs" 9334 "$@"; }
with() { printf '%s\n' "$1" > "$tmp/with.js"; cat "$2" >> "$tmp/with.js"; echo "$tmp/with.js"; }
name="inkdrop-$theme-acrylic-$bg-$focus"
mkdir -p "$out/screenshots" "$out/measurements" "$tmp/bin"
[ -x "$tmp/bin/backdrop" ] || swiftc -O "$p2b/backdrop.swift" -o "$tmp/bin/backdrop"

bash "$root/tests/visual/other-window.sh" hide obsidian
cdp eval "$(with "window.__P2B_THEME = \"$theme\";" "$p2b/inkdrop-select-theme.js")" > "$tmp/theme.json"
cdp eval "$(with 'window.__P2B_STATE = "reset";' "$p2b/inkdrop-state.js")" > /dev/null
cdp eval "$p2b/inkdrop-window-geometry.js" > "$tmp/geometry.json"
"$tmp/bin/backdrop" "$bg" 300 150 1400 900 $([ "$focus" = inactive ] && echo activate) &
bpid=$!
sleep 1
if [ "$focus" = active ]; then osascript -e 'tell application "Inkdrop" to activate'; fi
sleep 2.5
cdp eval "$p2b/probe-inkdrop.js" > "$tmp/probe-before.json"
shot="$out/screenshots/$name.png"
/usr/sbin/screencapture -x -R400,250,1200,700 "$shot"
shot_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cdp eval "$p2b/probe-inkdrop.js" > "$tmp/probe-after.json"
kill "$bpid"; wait "$bpid" 2>/dev/null || true
bash "$root/tests/visual/other-window.sh" show obsidian

python3 -I - "$tmp/theme.json" "$tmp/geometry.json" "$tmp/probe-before.json" "$tmp/probe-after.json" "$shot" "$shot_time" "$theme" "$bg" "$focus" \
  > "$out/measurements/$name.json" <<'EOF'
import hashlib, json, subprocess, sys
theme_j, geom, before, after, shot, t, theme, bg, req = sys.argv[1:10]
dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", shot], capture_output=True, text=True).stdout.split()
b, a = json.load(open(before)), json.load(open(after))
print(json.dumps({
    "capture": {
        "method": "/usr/sbin/screencapture -x -R400,250,1200,700 (native window-server composite, display colour space)",
        "capturedAt": t, "file": "screenshots/" + shot.rsplit("/", 1)[-1],
        "pixels": [int(dims[dims.index("pixelWidth:") + 1]), int(dims[dims.index("pixelHeight:") + 1])],
        "sha256": hashlib.sha256(open(shot, "rb").read()).hexdigest(),
        "windowRectPoints": [400, 250, 1200, 700], "backdrop": bg, "backdropRectPoints": [300, 150, 1400, 900],
        "requestedFocus": req, "theme": theme,
    },
    "theme": json.load(open(theme_j)),
    "geometry": json.load(open(geom)),
    # Only the state needed to judge the shot (window focus and acrylic), not the note content.
    "before": {"bodyClasses": b.get("bodyClasses"), "userAgent": b.get("userAgent")},
    "after": {"bodyClasses": a.get("bodyClasses")},
}, indent=1))
EOF
python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); b=d['before']['bodyClasses']; a=d['after']['bodyClasses']; print(sys.argv[2], '| blurred before/after:', 'is-blurred' in b, 'is-blurred' in a, '| acrylic:', 'acrylic-window' in b)" "$out/measurements/$name.json" "$name"
