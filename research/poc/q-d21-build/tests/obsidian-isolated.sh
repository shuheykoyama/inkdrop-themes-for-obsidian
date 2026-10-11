#!/usr/bin/env bash
# T3 helper: start / stop an ISOLATED Obsidian instance for the runtime test (same method as
# research/12 and evidence/phase2-p0/README.md). It never opens the user's vaults: a temporary
# --user-data-dir registers only a copy of the Phase 2B test vault.
#
# usage: tests/obsidian-isolated.sh start <work_dir>   -> prints the vault path, CDP on 127.0.0.1:9333
#        tests/obsidian-isolated.sh stop <work_dir>    -> stops only the process started here
set -euo pipefail
cmd="$1"; work="$2"
root="$(cd "$(dirname "$0")/.." && pwd)"
asar="$HOME/Library/Application Support/obsidian/obsidian-1.14.4.asar"

if [ "$cmd" = start ]; then
  mkdir -p "$work/userdata"
  cp "$asar" "$work/userdata/"
  rm -rf "$work/vault"
  cp -R "$root/../../evidence/phase2-p0/obsidian/test-vault" "$work/vault"
  printf '{"vaults":{"qd21poc000000001":{"path":"%s","ts":0,"open":true}}}' "$work/vault" > "$work/userdata/obsidian.json"
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
fi
