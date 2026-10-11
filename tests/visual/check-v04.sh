#!/usr/bin/env bash
# Operational check of tests/visual/sample-regions.py on the V-04 screenshots (research/12 §7.2):
#   1. with configs/v04.json it must reproduce the committed V-04 measurements byte for byte;
#   2. with a flatness limit, the V-04 background regions must still be valid (flat), and a region drawn
#      over the file list (text) must be rejected as not flat.
# Reads research/evidence/phase2-v04 only; writes to a temporary directory.
#
# usage: bash tests/visual/check-v04.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
v04="$root/research/evidence/phase2-v04"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
script="$root/tests/visual/sample-regions.py"
status=0

# 1. Same numbers as V-04 (same file list and order as the V-04 README command: screenshots/*.png).
python3 -I "$script" --config "$root/tests/visual/configs/v04.json" --out "$tmp/v04.csv" "$v04"/screenshots/*.png > /dev/null
if cmp -s "$tmp/v04.csv" "$v04/measurements/obsidian-v04-pixel-samples.csv"; then
  echo "PASS V-04 measurements reproduced byte for byte ($(($(wc -l < "$tmp/v04.csv") - 1)) rows)"
else
  echo "FAIL V-04 measurements differ"; diff "$tmp/v04.csv" "$v04/measurements/obsidian-v04-pixel-samples.csv" | head -10; status=1
fi

# 2a. The V-04 regions are flat background (max sd 1.0) in the opaque captures of both themes.
python3 - "$root/tests/visual/configs/v04.json" "$tmp/flat.json" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1])); cfg["max_sd"] = 1.0; json.dump(cfg, open(sys.argv[2], "w"))
PY
if python3 -I "$script" --config "$tmp/flat.json" --out "$tmp/flat.csv" "$v04"/screenshots/obsidian-D-sd-opaque-gray-active.png "$v04"/screenshots/obsidian-D-kd-opaque-gray-active.png > "$tmp/flat.log"; then
  echo "PASS V-04 regions are flat in the opaque captures (max sd 1.0)"
else
  echo "FAIL V-04 regions rejected as not flat"; grep '^FAIL' "$tmp/flat.log"; status=1
fi

# 2b. A region over the file explorer's names contains text: it must be rejected, never averaged.
python3 - "$tmp/flat.json" "$tmp/text.json" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1])); cfg["regions"] = {"file-list-with-text": [50, 40, 230, 160]}; cfg["references"] = {}
json.dump(cfg, open(sys.argv[2], "w"))
PY
if python3 -I "$script" --config "$tmp/text.json" --out "$tmp/text.csv" "$v04"/screenshots/obsidian-D-sd-opaque-gray-active.png > "$tmp/text.log"; then
  echo "FAIL a region with text was accepted as flat"; status=1
else
  echo "PASS a region with text is rejected: $(grep -m1 '^FAIL' "$tmp/text.log")"
fi
exit $status
