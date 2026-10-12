#!/usr/bin/env bash
# Start / stop an ISOLATED Obsidian instance for the runtime tests (same method as research/12 and
# research/poc/q-d21-build/tests/obsidian-isolated.sh). It never opens the user's vaults: a temporary
# --user-data-dir registers only a copy of tests/fixtures/vault. The user's Obsidian keeps running
# untouched; only the process started here is stopped.
#
# usage: bash tests/runtime/obsidian-isolated.sh start <work_dir>   -> prints the vault path; CDP on 127.0.0.1:9333
#        bash tests/runtime/obsidian-isolated.sh stop <work_dir>
# Requires macOS. Two environments (research/14 §6.3):
#   default: /Applications/Obsidian.app (installer 1.11.7, Electron 39.5.1) running the 1.14.4 asar from
#            ~/Library/Application Support/obsidian, copied read-only into the temporary user data dir;
#   current: OBSIDIAN_APP=<copy made by tests/runtime/current-installer.sh> OBSIDIAN_ASAR=none
#            (installer 1.14.4, Electron 43.7.7, its bundled app).
set -euo pipefail
cmd="$1"; work="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
app="${OBSIDIAN_APP:-/Applications/Obsidian.app}"
asar="${OBSIDIAN_ASAR:-$HOME/Library/Application Support/obsidian/obsidian-1.14.4.asar}"

if [ "$cmd" = start ]; then
  if curl -s --max-time 1 http://127.0.0.1:9333/json/version > /dev/null; then
    echo "port 9333 is already in use; refusing to start" >&2
    exit 1
  fi
  mkdir -p "$work/userdata"
  [ "$asar" = none ] || cp "$asar" "$work/userdata/"
  rm -rf "$work/vault"
  cp -R "$root/tests/fixtures/vault" "$work/vault"
  printf '{"vaults":{"inkthemetest0001":{"path":"%s","ts":0,"open":true}}}' "$work/vault" > "$work/userdata/obsidian.json"
  # No background throttling: with the screen locked or asleep the page counts as hidden and Chromium stretches
  # its timers (a 300 ms wait took over a second, later up to a minute), which stalled whole runs.
  "$app/Contents/MacOS/Obsidian" --user-data-dir="$work/userdata" \
    --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 \
    --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows \
    > "$work/obsidian.log" 2>&1 &
  echo $! > "$work/obsidian.pid"
  for _ in $(seq 1 30); do
    curl -s http://127.0.0.1:9333/json/list | grep -q 'app://obsidian.md' && break
    sleep 1
  done
  sleep 4
  echo "$work/vault"
elif [ "$cmd" = stop ]; then
  pid="$(cat "$work/obsidian.pid")"
  # The first SIGTERM is sometimes ignored after the runner has reloaded the window (mobile emulation);
  # a second one ends it. SIGKILL is the last resort and only ever targets the process started here.
  for sig in TERM TERM KILL; do
    kill -0 "$pid" 2>/dev/null || break
    kill -"$sig" "$pid" 2>/dev/null || true
    for _ in $(seq 1 15); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  done
  if kill -0 "$pid" 2>/dev/null; then echo "isolated Obsidian still running (pid $pid)"; exit 1; fi
  echo "stopped isolated Obsidian (pid $pid)"
else
  echo "usage: $0 start|stop <work_dir>" >&2
  exit 2
fi
