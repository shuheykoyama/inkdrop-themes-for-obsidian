#!/usr/bin/env bash
# Start the isolated Obsidian, run capture.mjs, and stop the isolated Obsidian on every exit path (success, failure,
# interrupt). Reuses tests/runtime/obsidian-isolated.sh; nothing else is started.
# usage: OBSIDIAN_ASAR=<obsidian-1.14.5.asar> bash capture-run.sh <work_dir> <out_dir> <base_repo> <trial_repo> [--check]
#   <work_dir> and <out_dir> must not exist. Needs the user's go-ahead: the window comes to the front.
set -euo pipefail
work="$1"; out="$2"; base="$3"; trial="$4"; shift 4
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
: "${OBSIDIAN_ASAR:?set OBSIDIAN_ASAR to the Obsidian 1.14.5 asar}"
[ ! -e "$work" ] && [ ! -e "$out" ] || { echo "work_dir or out_dir exists; refusing" >&2; exit 2; }
trap 'bash "$repo/tests/runtime/obsidian-isolated.sh" stop "$work" || true' EXIT
vault="$(bash "$repo/tests/runtime/obsidian-isolated.sh" start "$work" | tail -1)"
node "$here/capture.mjs" "$base" "$trial" "$vault" "$out" "$@"
