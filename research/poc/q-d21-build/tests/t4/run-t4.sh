#!/usr/bin/env bash
# T4: maintainability. Applies each change patch, rebuilds, reports how many source files / lines the
# change touched and which outputs changed, runs the static tests, then reverts the patch and checks
# that the sources are back to the baseline.
#   p12-*.patch: change for P1 and P2 (they share src/); p3-*.patch: the same change for P3.
#
# usage: tests/t4/run-t4.sh        (from research/poc/q-d21-build, after `npm ci`)
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

srchash() { find src p3-sass -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-16; }
build_into() { # <dir>
  node p1-postcss/build.mjs src "$1/p1" > /dev/null
  bash p2-concat/build.sh src "$1/p2" > /dev/null
  node_modules/.bin/sass --no-source-map --no-charset --style=expanded p3-sass/scss/themes:"$1/p3"
}

base_hash="$(srchash)"
build_into "$tmp/base"
printf '| patch | methods | files | +lines | -lines | changed output lines (SD / KD) per method | static tests |\n|---|---|---|---|---|---|---|\n'
for patch in tests/t4/*.patch; do
  name="$(basename "$patch" .patch)"
  case "$name" in p12-*) methods="p1 p2" ;; p3-*) methods="p3" ;; esac
  files="$(grep -c '^+++ ' "$patch")"
  plus="$(grep -c '^+[^+]' "$patch" || true)"
  minus="$(grep -c '^-[^-]' "$patch" || true)"
  git apply "$patch"
  build_into "$tmp/$name"
  changes=""
  for m in $methods; do
    sd="$(diff "$tmp/base/$m/solarized-dark.css" "$tmp/$name/$m/solarized-dark.css" | grep -c '^>' || true)"
    kd="$(diff "$tmp/base/$m/kanagawa-dragon.css" "$tmp/$name/$m/kanagawa-dragon.css" | grep -c '^>' || true)"
    changes="$changes $m: $sd / $kd;"
  done
  # The static tests build from the working tree, so they see the patched sources.
  static="$(node tests/test-static.mjs | grep -c '^FAIL' || true) FAIL"
  git apply -R "$patch"
  [ "$(srchash)" = "$base_hash" ] || { echo "sources not restored after $name" >&2; exit 1; }
  printf '| %s | %s | %s | %s | %s |%s | %s |\n' "$name" "$methods" "$files" "$plus" "$minus" "$changes" "$static"
done
echo
echo "sources restored to baseline: $base_hash"
