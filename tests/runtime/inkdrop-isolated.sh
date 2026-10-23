#!/usr/bin/env bash
# Step 11G G6 (research/14 §6.95): start / stop an ISOLATED Inkdrop for V-35. Inkdrop 6.1.5 takes its user data
# directory from INKDROP_USER_DATA_PATH (main process, read statically from the public 6.1.5 app.asar), so the
# instance started here keeps its config.json, packages/ and db/ in <work>/user-data and never opens the
# user's own profile. Its debugger listens on 127.0.0.1:9334 only. The user's own Inkdrop is never started,
# stopped or signalled here: its PIDs are recorded before the start and must be the same after the stop.
#
# NOT isolated: the sign-in credentials. Inkdrop keeps them in the macOS keychain under the service "inkdrop"
# whatever the user data directory is, so this instance reads (and a sign-in or sign-out in it would write or
# clear) the same entries as the user's Inkdrop. Never sign out in the isolated instance (research/14 §6.95.2).
#
# usage: bash tests/runtime/inkdrop-isolated.sh start <work_dir>   exit 0 started, 3 not started (another
#                                                                  Inkdrop holds the single-instance lock), 1 failed
#        bash tests/runtime/inkdrop-isolated.sh stop <work_dir>    exit 0 stopped and the user's Inkdrop unchanged
# G6_PACKAGES=<dir> copies theme packages into the isolated packages/ before the start (never the user's).
# INKDROP_APP replaces /Applications/Inkdrop.app, G6_PROD_DIR the user's data directory (self-test only).
set -euo pipefail
cmd="$1"; work="$2"
app="${INKDROP_APP:-/Applications/Inkdrop.app}"
prod="${G6_PROD_DIR:-$HOME/Library/Application Support/inkdrop}"
port=9334
# PIDs of the Inkdrop main processes other than the one started here (helpers have other names).
others() { pgrep -x Inkdrop | grep -vx "$(cat "$work/inkdrop.pid" 2>/dev/null || echo none)" | sort || true; }

if [ "$cmd" = start ]; then
  if curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null; then
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
  INKDROP_USER_DATA_PATH="$data" "$app/Contents/MacOS/Inkdrop" \
    --remote-debugging-port=$port --remote-debugging-address=127.0.0.1 > "$work/inkdrop.log" 2>&1 &
  echo $! > "$work/inkdrop.pid"
  pid="$(cat "$work/inkdrop.pid")"
  for _ in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || break
    curl -s "http://127.0.0.1:$port/json/list" | grep -q "file://$app" && break
    sleep 1
  done
  if ! kill -0 "$pid" 2>/dev/null; then
    # Inkdrop quits at once when another instance holds the lock (it logs "Quit because of duplicated instance").
    if grep -q "duplicated instance" "$work/inkdrop.log"; then echo "NOT STARTED: another Inkdrop holds the single-instance lock"; exit 3; fi
    echo "isolated Inkdrop exited during the start" >&2; exit 1
  fi
  sleep 3
  echo "$data"
elif [ "$cmd" = stop ]; then
  pid="$(cat "$work/inkdrop.pid")"
  for sig in TERM TERM KILL; do
    kill -0 "$pid" 2>/dev/null || break
    kill -"$sig" "$pid" 2>/dev/null || true
    for _ in $(seq 1 15); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  done
  if kill -0 "$pid" 2>/dev/null; then echo "isolated Inkdrop still running (pid $pid)"; exit 1; fi
  if curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null; then echo "port $port still open"; exit 1; fi
  others > "$work/others-after.txt"
  if ! cmp -s "$work/others-before.txt" "$work/others-after.txt"; then echo "the user's Inkdrop processes changed during the run"; exit 1; fi
  echo "stopped isolated Inkdrop (pid $pid); the user's Inkdrop processes unchanged"
else
  echo "usage: $0 start|stop <work_dir>" >&2; exit 2
fi
