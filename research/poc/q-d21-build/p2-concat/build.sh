#!/usr/bin/env bash
# P2: plain concatenation of the same Vanilla CSS files that P1 imports, in the same order.
# The order is listed here (it duplicates the @import list of src/themes/<theme>.css).
# Output: dist/p2/<theme>.css
#
# usage: p2-concat/build.sh [src_dir] [out_dir]
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:-$root/src}"
out="${2:-$root/dist/p2}"
mkdir -p "$out"
for theme in solarized-dark kanagawa-dragon; do
  # cat fails (and set -e stops the build with a non-zero status) if any file is missing.
  cat "$src/palette/$theme.css" \
      "$src/common/mapping.css" \
      "$src/common/components.css" \
      "$src/common/translucent.css" \
      "$src/common/mobile.css" > "$out/$theme.css.tmp"
  mv "$out/$theme.css.tmp" "$out/$theme.css"
  echo "p2: ${out#"$root"/}/$theme.css"
done
