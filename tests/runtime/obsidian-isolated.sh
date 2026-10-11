#!/usr/bin/env bash
# Start / stop an ISOLATED Obsidian instance for the runtime tests (same method as research/12 and
# research/poc/q-d21-build/tests/obsidian-isolated.sh). It never opens the user's vaults: a temporary
# --user-data-dir registers only a copy of tests/fixtures/vault. The user's Obsidian keeps running
# untouched; only the process started here is stopped.
#
# usage: bash tests/runtime/obsidian-isolated.sh start <work_dir>   -> prints the vault path; CDP on 127.0.0.1:9333
#        bash tests/runtime/obsidian-isolated.sh stop <work_dir>
# Requires macOS and Obsidian 1.14.4 (the installer's asar in ~/Library/Application Support/obsidian is
# copied read-only into the temporary user data directory).
set -euo pipefail
cmd="$1"; work="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
asar="$HOME/Library/Application Support/obsidian/obsidian-1.14.4.asar"

if [ "$cmd" = start ]; then
  if curl -s --max-time 1 http://127.0.0.1:9333/json/version > /dev/null; then
    echo "port 9333 is already in use; refusing to start" >&2
    exit 1
  fi
  mkdir -p "$work/userdata"
  cp "$asar" "$work/userdata/"
  rm -rf "$work/vault"
  cp -R "$root/tests/fixtures/vault" "$work/vault"
  printf '{"vaults":{"inkthemetest0001":{"path":"%s","ts":0,"open":true}}}' "$work/vault" > "$work/userdata/obsidian.json"
  /Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$work/userdata" \
    --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 > "$work/obsidian.log" 2>&1 &
  echo $! > "$work/obsidian.pid"
  for _ in $(seq 1 30); do
    curl -s http://127.0.0.1:9333/json/list | grep -q 'app://obsidian.md' && break
    sleep 1
  done
  sleep 4
  echo "$work/vault"
elif [ "$cmd" = stop ]; then
  pid="$(cat "$work/obsidian.pid")"
  kill "$pid"
  for _ in $(seq 1 15); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then echo "isolated Obsidian still running (pid $pid)"; exit 1; fi
  echo "stopped isolated Obsidian (pid $pid)"
else
  echo "usage: $0 start|stop <work_dir>" >&2
  exit 2
fi
