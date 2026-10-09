#!/usr/bin/env bash
# Regenerate the machine-readable data of research/data/ into an output directory,
# then compare it with the committed files.
#
# usage: research/tools/regenerate.sh <work_dir> <out_dir>
#   <work_dir>  directory prepared by fetch_sources.sh
#   <out_dir>   where regenerated files are written (research/data/ is never overwritten)
#
# The comparison result is printed per file as MATCH / DIFF / MISSING; every file is expected
# to MATCH. The exit status is 1 when any comparison or check fails (see research/tools/README.md).
set -euo pipefail

work="${1:?usage: regenerate.sh <work_dir> <out_dir>}"
out="${2:?usage: regenerate.sh <work_dir> <out_dir>}"
here="$(cd "$(dirname "$0")" && pwd)"
research="$(cd "$here/.." && pwd)"
repos="$work/repos"
py="python3 -I"

mkdir -p "$out/data" "$out/tmp"

# 01: base token inventory of @inkdropapp/css
$py "$here/analyze_tokens.py" "$repos" "$out/data/inkdrop-base-tokens.csv" "$out/tmp/token-summary.json"

# 02: per-theme resolved tokens and palettes
$py "$here/resolve_tokens.py" "$repos" solarized-dark "$out/data/inkdrop-solarized-dark-tokens.csv"
$py "$here/resolve_tokens.py" "$repos" kanagawa-dragon "$out/data/inkdrop-kanagawa-dragon-tokens.csv"
$py "$here/build_palettes.py" "$repos" "$out/data/inkdrop-palettes.json"

# 03: Obsidian CSS variable inventory (1.14.4 vs 1.13.7 vs docs)
$py "$here/cssvars.py" \
  "$work/obsidian-app/asar-1.14.4/app.css" \
  "$work/obsidian-app/asar-1.13.7/app.css" \
  "$repos/obsidianmd_obsidian-developer-docs/en/Reference/CSS variables" \
  "$out/data/obsidian-css-variables-1.14.4.csv" "$out/tmp/cssvars-summary.json"
# Hand-confirmed notes (docs typos, inline-style injection) kept as data, see manual_notes.json.
$py "$here/apply_manual_notes.py" "$out/data/obsidian-css-variables-1.14.4.csv" "$here/manual_notes.json"

# 05: UI inventory (rows are hand-curated inside mkcsv.py)
$py "$here/mkcsv.py" "$out/data/obsidian-ui-inventory.csv"

# 06 / 07: mapping candidates and contrast ratios read the token CSVs from a research dir,
# so stage the freshly generated token CSVs in a scratch research tree first.
mkdir -p "$out/tmp/research/data"
cp "$out"/data/inkdrop-*-tokens.csv "$out/tmp/research/data/"
$py "$here/gen_mapping.py" "$out/tmp/research" "$out/tmp/mapping-fragment.md"
$py "$here/contrast.py" "$out/tmp/research"
cp "$out/tmp/research/data/mapping-candidates.csv" "$out/tmp/research/data/inkdrop-contrast.csv" "$out/data/"

# Python's csv module writes CRLF; the committed files use LF.
for f in "$out"/data/*.csv; do
  $py -c 'import sys,pathlib; p=pathlib.Path(sys.argv[1]); p.write_bytes(p.read_bytes().replace(b"\r\n", b"\n"))' "$f"
done

status=0
echo "== comparison with research/data"
for f in "$research"/data/*; do
  name="$(basename "$f")"
  if [ ! -f "$out/data/$name" ]; then
    echo "MISSING $name"; status=1
  elif cmp -s "$f" "$out/data/$name"; then
    echo "MATCH   $name"
  else
    echo "DIFF    $name ($(diff "$f" "$out/data/$name" | grep -c '^[<>]') changed lines)"; status=1
  fi
done

echo "== generated block of 06-mapping-candidates.md"
$py "$here/splice_generated.py" "$research/06-mapping-candidates.md" "$out/tmp/mapping-fragment.md" --check || status=1

echo "== links, data files, ID uniqueness"
$py "$here/final_check.py" "$research" || status=1

exit $status
