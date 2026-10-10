#!/usr/bin/env bash
# V-04: load one diagnostic CSS case into the isolated test vault, switch translucency, and record
# the computed backgrounds (Computed Style only; no screenshot).
#
# usage: probe-case.sh <case-name> <translucent|opaque> <vault_dir> <scratch_dir>
#   <case-name>: file name in ../diagnostic-css without .css
# Requires the isolated Obsidian instance on 127.0.0.1:9333 (see ../README.md).
set -euo pipefail
case_name="$1"; mode="$2"; vault="$3"; tmp="$4"
here="$(cd "$(dirname "$0")" && pwd)"
ev="$(cd "$here/.." && pwd)"
cdp() { node "$ev/../phase2-p0/tools/cdp.mjs" 9333 "$@"; }

cp "$ev/diagnostic-css/$case_name.css" "$vault/.obsidian/themes/P2B-Diagnostic/theme.css"
{ printf 'window.__V04 = {translucent: %s};\n' "$([ "$mode" = translucent ] && echo true || echo false)"; cat "$here/obsidian-setup.js"; } > "$tmp/setup-with.js"
cdp eval "$tmp/setup-with.js" > /dev/null
cdp eval "$here/probe-translucency.js" > "$ev/measurements/css-$case_name-$mode.json"
echo "measurements/css-$case_name-$mode.json"
