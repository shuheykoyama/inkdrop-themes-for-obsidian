#!/usr/bin/env bash
# Step 11G G6 (research/14 §6.95, §6.97): start / stop an ISOLATED Inkdrop for V-35. Inkdrop 6.1.5 takes its
# user data directory from INKDROP_USER_DATA_PATH (main process, read statically from the public 6.1.5
# app.asar), so the instance started here keeps its config.json, packages/ and db/ in <work>/user-data and
# never opens the user's own profile. Its debugger listens on 127.0.0.1:9334 only. The user's own Inkdrop is
# never started, stopped or signalled here: only the PID this script started is ever signalled, and the other
# Inkdrop PIDs are recorded before the start and must be the same after the stop.
#
# NOT isolated: the sign-in credentials. Inkdrop keeps them in the macOS keychain under the service "inkdrop"
# whatever the user data directory is, so this instance reads (and a sign-in or sign-out in it would write or
# clear) the same entries as the user's Inkdrop. Never sign in or out in the isolated instance (§6.97).
#
# usage: bash tests/runtime/inkdrop-isolated.sh start <work_dir>
#          exit 0 started: the PID is alive, its page is on 127.0.0.1:9334 and the listener on 9334 is that PID
#          exit 3 not started: another Inkdrop holds the single-instance lock (the started process quit by itself)
#          exit 1 not started, and the started process (if any) was stopped again
#          exit 5 not started, and the started process could NOT be confirmed stopped
#        bash tests/runtime/inkdrop-isolated.sh stop <work_dir>
#          exit 0 only when the process is gone, 9334 is closed and the user's Inkdrop PIDs are unchanged
# The app name in front before and after the start is recorded (front.txt): a start blocked by the lock may
# bring the user's Inkdrop to the front, which is recorded and never "restored" by guessing.
# G6_PACKAGES=<dir> copies theme packages into the isolated packages/ before the start (never the user's).
# Self-test only: INKDROP_APP replaces /Applications/Inkdrop.app, G6_PROD_DIR the user's data directory,
# G6_PORT the port, G6_START_TIMEOUT and G6_STOP_WAIT the seconds to wait, G6_TEST_KILL the kill command.
set -euo pipefail
cmd="$1"; work="$2"
app="${INKDROP_APP:-/Applications/Inkdrop.app}"
prod="${G6_PROD_DIR:-$HOME/Library/Application Support/inkdrop}"
port="${G6_PORT:-9334}"
killcmd="${G6_TEST_KILL:-kill}"
# PIDs of the Inkdrop main processes other than the one started here (helpers have other names).
others() { pgrep -x Inkdrop | grep -vx "$(cat "$work/inkdrop.pid" 2>/dev/null || echo none)" | sort || true; }
listener() { lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
front() { command -v lsappinfo > /dev/null && lsappinfo info -only name "$(lsappinfo front)" 2>/dev/null | sed 's/.*"\(.*\)"/\1/' || echo unknown; }
# Stop the started PID only: TERM, TERM, KILL; true when it is gone.
stop_pid() {
  local pid="$1"
  for sig in TERM TERM KILL; do
    kill -0 "$pid" 2>/dev/null || return 0
    "$killcmd" -"$sig" "$pid" 2>/dev/null || true
    for _ in $(seq 1 "${G6_STOP_WAIT:-15}"); do kill -0 "$pid" 2>/dev/null || return 0; sleep 1; done
  done
  ! kill -0 "$pid" 2>/dev/null
}
# A start that did not succeed: stop what was started; exit 1 if that worked, 5 if not.
abort() {
  echo "NOT STARTED: $1"
  if stop_pid "$pid"; then echo "the started process (pid $pid) is stopped"; exit 1; fi
  echo "CLEANUP FAILED: the started process (pid $pid) is still running"; exit 5
}

if [ "$cmd" = start ]; then
  if curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null || [ -n "$(listener)" ]; then
    echo "port $port is already in use; refusing to start" >&2; exit 1
  fi
  mkdir -p "$work/user-data"
  data="$(cd "$work/user-data" && pwd -P)"
  # The isolated directory must not be the user's profile or inside it.
  case "$data/" in "$(cd "$prod" 2>/dev/null && pwd -P || echo "$prod")/"*) echo "work dir is inside the user's Inkdrop profile; refusing" >&2; exit 1 ;; esac
  # G6_PACKAGES=<dir from tests/visual/g6-packages.sh>: the theme packages go into the isolated packages/ only.
  if [ -n "${G6_PACKAGES:-}" ]; then mkdir -p "$data/packages"; cp -R "$G6_PACKAGES"/. "$data/packages/"; fi
  others > "$work/others-before.txt"
  echo "$data" > "$work/data-path.txt"
  echo "before $(front)" > "$work/front.txt"
  INKDROP_USER_DATA_PATH="$data" "$app/Contents/MacOS/Inkdrop" \
    --remote-debugging-port="$port" --remote-debugging-address=127.0.0.1 > "$work/inkdrop.log" 2>&1 &
  pid=$!
  echo "$pid" > "$work/inkdrop.pid"
  up=false
  for _ in $(seq 1 "${G6_START_TIMEOUT:-40}"); do
    kill -0 "$pid" 2>/dev/null || break
    if curl -s --max-time 1 "http://127.0.0.1:$port/json/list" | grep -q "file://$app"; then up=true; break; fi
    sleep 1
  done
  sleep 1
  echo "after $(front)" >> "$work/front.txt"
  if ! kill -0 "$pid" 2>/dev/null; then
    # Inkdrop quits at once when another instance holds the lock (it logs "Quit because of duplicated instance").
    if grep -q "duplicated instance" "$work/inkdrop.log"; then echo "NOT STARTED: another Inkdrop holds the single-instance lock (front app: $(paste -sd' ' "$work/front.txt"))"; exit 3; fi
    echo "NOT STARTED: the started process exited"; exit 1
  fi
  [ "$up" = true ] || abort "no Inkdrop page on 127.0.0.1:$port within the timeout"
  [ "$(listener)" = "$pid" ] || abort "the listener on $port is pid $(listener), not the started pid $pid"
  sleep 3
  echo "$data"
elif [ "$cmd" = stop ]; then
  pid="$(cat "$work/inkdrop.pid")"
  stop_pid "$pid" || { echo "isolated Inkdrop still running (pid $pid)"; exit 1; }
  if curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null || [ -n "$(listener)" ]; then echo "port $port still open"; exit 1; fi
  others > "$work/others-after.txt"
  if ! cmp -s "$work/others-before.txt" "$work/others-after.txt"; then echo "the user's Inkdrop processes changed during the run"; exit 1; fi
  echo "stopped isolated Inkdrop (pid $pid); port $port closed; the user's Inkdrop processes unchanged"
else
  echo "usage: $0 start|stop <work_dir>" >&2; exit 2
fi
