#!/usr/bin/env bash
# Step 11G G6 method C (research/14 §6.107): the whole V-35 run on the user's Inkdrop in one go, so that once
# `prepare` has made a backup, `restore` runs on every way out (trap on EXIT): a failed start, restart, check,
# capture or a note that changed all end in the restore. The capture result and the restore result are reported
# separately; without RESTORED the user's Inkdrop is not called usable. Only after the user's approval of
# method C and their go right before; it uses the screen for about 12 to 18 minutes.
#
# usage: bash tests/visual/g6-c-run.sh <work> <out> <tmp>
#   <work>  new directory outside the repository, iCloud and the Inkdrop profile (raw data in <work>/private)
#   <out>   new directory for the public captures and records; <tmp> holds the backdrop binary
# exit 0 only when all 8 captures were taken and the restore says RESTORED; 1 otherwise.
# G6_TEST_PROD / G6_TEST_RUN replace tests/runtime/inkdrop-production.sh / tests/visual/g6-run.mjs (self-test).
set -uo pipefail
work="$1"; out="$2"; tmp="$3"
cd "$(dirname "$0")/../.."
PROD="${G6_TEST_PROD:-bash tests/runtime/inkdrop-production.sh}"
RUN="${G6_TEST_RUN:-node tests/visual/g6-run.mjs}"
capture="not started"
restored=no

finish() {
  local rc=$?
  if [ -f "$work/private/backup/config.json" ] && [ "$restored" = no ]; then
    restored=yes
    echo "-- restore"
    rout="$($PROD restore "$work" 2>&1)"; rrc=$?
    echo "$rout"
  else
    rout="not needed (no backup was made: nothing was changed by this run)"; rrc=0
  fi
  echo "CAPTURE: $capture"
  if [ ! -f "$work/private/backup/config.json" ]; then
    echo "RESTORE: $rout"
  elif [ $rrc -eq 0 ] && echo "$rout" | grep -q "^RESTORED"; then
    echo "RESTORE: $(echo "$rout" | grep "^RESTORED")"
  else
    echo "RESTORE: NOT CONFIRMED (exit $rrc). The user's Inkdrop is not known to be usable; what is left is listed above."
    rc=1
  fi
  [ "$capture" = "all 8 captures taken" ] && [ $rc -eq 0 ] && exit 0
  exit 1
}
trap finish EXIT

# One step: run it, stop the run (and so restore) on a non-zero exit.
step() {
  local name="$1"; shift
  echo "-- $name"
  "$@"; local r=$?
  if [ $r -ne 0 ]; then capture="stopped at $name (exit $r)"; exit 1; fi
}

step prepare $PROD prepare "$work"
step start $PROD start "$work"
step check $RUN isolation "$work" instance-1.json
step notes $RUN notes "$work" notes.json
# The tutorial note with a plain line and a code block line, from the private inventory (never printed).
read -r note plain code word < <(python3 -I -c '
import json, sys
d = json.load(open(sys.argv[1]))
n = next((n for n in d["notes"] if n["plainLines"] and n["codeLines"] and n.get("plainWord")), None)
print(*(n and [n["_id"], n["plainLines"][0], n["codeLines"][0], n["plainWord"]] or ["-"] * 4))' "$work/private/notes.json")
if [ "${note:--}" = - ]; then capture="stopped: no tutorial note with a plain line and a code block line (no note is created)"; exit 1; fi
step note-before $RUN note "$work" "$note" note-before.json
step settings-opaque $RUN settings "$work" false
step restart-opaque $PROD restart "$work"
step check-opaque $RUN isolation "$work" instance-2.json
step capture-opaque $RUN capture "$work" "$out" "$tmp" "$note" "$plain" "$code" "$word" opaque
step settings-acrylic $RUN settings "$work" true
step restart-acrylic $PROD restart "$work"
step check-acrylic $RUN isolation "$work" instance-3.json
step capture-acrylic $RUN capture "$work" "$out" "$tmp" "$note" "$plain" "$code" "$word" acrylic
step note-after $RUN note "$work" "$note" note-after.json
same="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1])) == json.load(open(sys.argv[2])))' "$work/private/note-before.json" "$work/private/note-after.json")"
if [ "$same" != True ]; then capture="stopped: the note differs between the start and the end of the run (nothing written back)"; exit 1; fi
capture="all 8 captures taken"
