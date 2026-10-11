#!/usr/bin/env bash
# Native macOS capture of the ISOLATED Obsidian window with a built theme, under the V-04 / V-32
# conditions (research/12 §7, research/11 §15): controlled backdrop behind the window, window 1200x700 pt
# at (400, 250), backdrop 1400x900 at (300, 150), screencapture of that rectangle. Reuses the V-04 tools
# (backdrop.swift, obsidian-focus.js, obsidian-raise.js) without modifying them.
#
# usage: bash tests/visual/capture-obsidian.sh <theme> <translucent|opaque> <gray|pattern> <active|inactive> <vault> <out_dir> <tmp_dir>
# Requires the isolated instance on 127.0.0.1:9333 and screen-recording permission already granted (this
# script never changes privacy settings). Inspect every image before committing it: the capture is a
# screen rectangle, so anything covering the window would be in it.
set -euo pipefail
theme="$1"; mode="$2"; bg="$3"; focus="$4"; vault="$5"; out="$6"; tmp="$7"
root="$(cd "$(dirname "$0")/../.." && pwd)"
v04="$root/research/evidence/phase2-v04/tools"
cdp() { node "$root/research/evidence/phase2-p0/tools/cdp.mjs" 9333 "$@"; }
# CAPTURE_NOTE / CAPTURE_VIEW / CAPTURE_SCROLL (optional, step 6): open that note in that view ("source",
# "live", "reading"), scrolled to the line containing CAPTURE_SCROLL; the file name gets "-<view>[-<tag>]"
# (CAPTURE_TAG).
name="obsidian-$theme-$mode-$bg-$focus${CAPTURE_VIEW:+-$CAPTURE_VIEW}${CAPTURE_TAG:+-$CAPTURE_TAG}"
mkdir -p "$out/screenshots" "$out/measurements" "$tmp/bin"
[ -x "$tmp/bin/backdrop" ] || swiftc -O "$root/research/evidence/phase2-p0/tools/backdrop.swift" -o "$tmp/bin/backdrop"

# CAPTURE_THEME_DIR (optional): a directory with theme.css and manifest.json to capture instead of
# dist/<theme>, e.g. a V-04 diagnostic stylesheet to re-measure the V-04 baseline under today's conditions.
src="${CAPTURE_THEME_DIR:-$root/dist/$theme}"
manifest_name="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).name)' "$src/manifest.json")"
mkdir -p "$vault/.obsidian/themes/$manifest_name"
cp "$src/theme.css" "$src/manifest.json" "$vault/.obsidian/themes/$manifest_name/"
{ printf 'window.__CAP = %s;\n' "$(node -e 'console.log(JSON.stringify({ theme: process.argv[1], translucent: process.argv[2] === "translucent", note: process.argv[3] || undefined, view: process.argv[4] || undefined, scrollTo: process.argv[5] || undefined }))' "$manifest_name" "$mode" "${CAPTURE_NOTE:-}" "${CAPTURE_VIEW:-}" "${CAPTURE_SCROLL:-}")"; cat "$root/tests/visual/obsidian-capture-setup.js"; } > "$tmp/setup.js"
cdp eval "$tmp/setup.js" > "$tmp/setup.json"

# V-38: the Inkdrop window (if one is running with its DevTools endpoint) uses the same rectangle; hide it.
bash "$root/tests/visual/other-window.sh" hide inkdrop
cdp eval "$v04/obsidian-focus.js" > /dev/null
"$tmp/bin/backdrop" "$bg" 300 150 1400 900 $([ "$focus" = inactive ] && echo activate) &
bpid=$!
sleep 1.8  # the backdrop activates itself 1 s after start (inactive case)
if [ "$focus" = active ]; then cdp eval "$v04/obsidian-focus.js" > "$tmp/focus.json"; else cdp eval "$v04/obsidian-raise.js" > "$tmp/focus.json"; fi
sleep 2.5
shot="$out/screenshots/$name.png"
/usr/sbin/screencapture -x -R400,250,1200,700 "$shot"
shot_time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo '(() => ({ focused: electronWindow.isFocused(), cls: [...document.body.classList].filter((c) => /^is-(translucent|focused|fullscreen)$/.test(c)) }))()' > "$tmp/after.js"
cdp eval "$tmp/after.js" > "$tmp/after.json"
kill "$bpid"; wait "$bpid" 2>/dev/null || true
bash "$root/tests/visual/other-window.sh" show inkdrop

python3 -I - "$tmp/setup.json" "$tmp/focus.json" "$tmp/after.json" "$shot" "$shot_time" "$theme" "$mode" "$bg" "$focus" > "$out/measurements/$name.json" <<'EOF'
import hashlib, json, subprocess, sys
setup, focus, after, shot, t, theme, mode, bg, req = sys.argv[1:10]
dims = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", shot], capture_output=True, text=True).stdout.split()
print(json.dumps({
    "capture": {
        "method": "/usr/sbin/screencapture -x -R400,250,1200,700 (native window-server composite, display colour space)",
        "capturedAt": t, "file": "screenshots/" + shot.rsplit("/", 1)[-1],
        "pixels": [int(dims[dims.index("pixelWidth:") + 1]), int(dims[dims.index("pixelHeight:") + 1])],
        "sha256": hashlib.sha256(open(shot, "rb").read()).hexdigest(),
        "windowRectPoints": [400, 250, 1200, 700], "backdrop": bg, "backdropRectPoints": [300, 150, 1400, 900],
        "requestedFocus": req, "translucency": mode, "theme": theme,
    },
    "setup": json.load(open(setup)),
    "focusStep": json.load(open(focus)),
    "afterShot": json.load(open(after)),
}, indent=1))
EOF
python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); s=d['setup']; a=d['afterShot']; print(sys.argv[2], '| electron', s['electron'], '| translucent', s['isTranslucent'], '| focused after', a['focused'], a['cls'])" "$out/measurements/$name.json" "$name"
