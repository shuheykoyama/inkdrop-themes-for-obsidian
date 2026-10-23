#!/usr/bin/env bash
# Step 11G G6 (research/14 §6.95): the two Inkdrop theme packages at the commits analysed in research/00
# (Solarized Dark 2.2.1, Kanagawa Dragon 1.2.1), laid out as <out>/<package name>/ for the isolated Inkdrop's
# packages/ directory (tests/runtime/inkdrop-isolated.sh, G6_PACKAGES). Only public repositories are read;
# nothing is installed anywhere else. Prints each package's name, version and a SHA-256 over its files.
#
# usage: bash tests/visual/g6-packages.sh <new out dir> <tmp dir>
set -euo pipefail
out="$1"; tmp="$2"
[ -e "$out" ] && { echo "$out exists" >&2; exit 2; }
mkdir -p "$out" "$tmp"
fetch() { # repo commit subdir
  local dir="$tmp/$(basename "$1")-$2"
  [ -d "$dir" ] || { git init -q "$dir"; git -C "$dir" fetch -q --depth 1 "https://github.com/$1" "$2"; git -C "$dir" checkout -q FETCH_HEAD; }
  local src="$dir/$3"
  local name; name="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$src/package.json")"
  mkdir -p "$out/$name"
  # The files a theme package needs at run time (as in research/11 §14.1): package.json, palette.json, styles/.
  cp "$src/package.json" "$out/$name/"
  [ -f "$src/palette.json" ] && cp "$src/palette.json" "$out/$name/"
  cp -R "$src/styles" "$out/$name/"
  local ver; ver="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$src/package.json")"
  local sum; sum="$(cd "$out/$name" && find . -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-64)"
  echo "$name $ver $1@$2 files-sha256 $sum"
}
fetch inkdropapp/solarized-dark 4337f6e5ea9871b6193b5a3bf8db6206de2c3678 .
fetch inkdropapp/kanagawa f9c14a57392c64b85527860eae9eb58c1b03ba32 packages/dragon
