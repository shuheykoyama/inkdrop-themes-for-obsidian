#!/usr/bin/env bash
# Step 11G G7-1 (research/14 §6.125): the Inkdrop 6.2.0 syntax measurement on the user's Inkdrop (method C, as G6)
# in one go: prepare (config backup), start, check, create the one temporary verification note, measure both themes
# in the editor and the preview (with reference captures), delete the note, restore. On every way out (trap on EXIT)
# the note is deleted if this run recorded one and has not deleted it, then the config is restored. Three results
# are reported apart: MEASURE (COMPLETE only when all 4 theme x view measurements are), NOTE (REMOVED / ABSENT /
# NOT REMOVED) and RESTORE (as G6). Deleting the note does not undo its sync history or database records; only
# that the note is gone is checked. Only after the review and the user's approval, and their go right before.
#
# usage: bash tests/visual/g7-c-run.sh <work> <out> <tmp>
#   <work>  a directory that does not exist yet, outside the repository, iCloud and the Inkdrop profile (the note ID
#           and the raw records in <work>/private)
#   <out>   a directory that does not exist yet, for the measurements and the reference captures
#   <tmp>   holds the backdrop binary
# exit 0 only when MEASURE is COMPLETE, NOTE is REMOVED and RESTORE is RESTORED; 1 otherwise.
# G6_TEST_PROD / G6_TEST_RUN replace tests/runtime/inkdrop-production.sh / tests/visual/g6-run.mjs (self-test).
set -uo pipefail
work="$1"; out="$2"; tmp="$3"
cd "$(dirname "$0")/../.."
if [ -e "$work" ] || [ -e "$out" ]; then echo "REFUSED: $([ -e "$work" ] && echo "<work>" || echo "<out>") already exists; nothing was run"; exit 1; fi
mkdir -p "$work"
PROD="${G6_TEST_PROD:-bash tests/runtime/inkdrop-production.sh}"
RUN="${G6_TEST_RUN:-node tests/visual/g6-run.mjs}"
NOTE_MD="tests/fixtures/vault/Code blocks.md"
measure="not started"
note="not created"
restored=no

finish() {
  local rc=$?
  # The note first (it needs the running Inkdrop), then the config.
  if [ -f "$work/private/g7-note.json" ] && [ "$note" != REMOVED ] && [ "$note" != ABSENT ]; then
    echo "-- note-remove (clean-up)"
    nout="$($RUN note-remove "$work" 2>&1)"; echo "$nout"
    note="$(echo "$nout" | tail -1)"
  fi
  if [ -f "$work/private/backup/config.sha256" ] && [ "$restored" = no ]; then
    restored=yes
    echo "-- restore"
    rout="$($PROD restore "$work" 2>&1)"; rrc=$?
    echo "$rout"
  else
    rout="not run (no confirmed backup of this run)"; rrc=0
  fi
  echo "MEASURE: $measure"
  echo "NOTE: $note"
  case "$note" in REMOVED*|ABSENT*|"not created") ;; *) echo "  the temporary note may still be in the user's Inkdrop: its ID is in <work>/private/g7-note.json"; rc=1 ;; esac
  if [ ! -f "$work/private/backup/config.sha256" ]; then
    echo "RESTORE: $rout"
  elif [ $rrc -eq 0 ] && echo "$rout" | grep -q "^RESTORED"; then
    echo "RESTORE: $(echo "$rout" | grep "^RESTORED")"
  else
    echo "RESTORE: NOT CONFIRMED (exit $rrc). The user's Inkdrop is not known to be usable; what is left is listed above."
    rc=1
  fi
  case "$measure" in COMPLETE*) case "$note" in REMOVED*) [ $rc -eq 0 ] && exit 0 ;; esac ;; esac
  exit 1
}
trap finish EXIT

step() {
  local name="$1"; shift
  echo "-- $name"
  "$@"; local r=$?
  if [ $r -ne 0 ]; then measure="stopped at $name (exit $r)"; exit 1; fi
}

step prepare $PROD prepare "$work"
step start $PROD start "$work"
step check $RUN isolation "$work" instance-1.json
step note-create $RUN note-create "$work" "$NOTE_MD"
note="CREATED (not yet removed)"
incomplete=""
for theme in solarized-dark kanagawa-dragon; do
  echo "-- syntax $theme"
  $RUN syntax "$work" "$out" "$tmp" "$NOTE_MD" "$theme"; r=$?
  # 5: a view was not fully measured; its records are kept and the run goes on, but MEASURE is not COMPLETE.
  if [ $r -eq 5 ]; then incomplete="$incomplete $theme"
  elif [ $r -ne 0 ]; then measure="stopped at syntax $theme (exit $r)"; exit 1; fi
done
echo "-- note-remove"
nout="$($RUN note-remove "$work" 2>&1)"; echo "$nout"
note="$(echo "$nout" | tail -1)"
if [ -n "$incomplete" ]; then measure="INCOMPLETE:$incomplete (see the measurements)"; exit 1; fi
measure="COMPLETE: both themes, editor and preview, all 21 blocks"
