#!/usr/bin/env bash
# Step 11G G6 method C (research/14 §6.103, §6.105): run the user's own Inkdrop for V-35 and put it back.
# Only with the user's explicit approval of method C and their go right before. Never signs in or out, never
# reads the keychain, never writes a note, never force-quits (a force quit can damage the database).
#
#   prepare <work>  record whether Inkdrop runs; quit it normally if it does; back up config.json (after the
#                   quit) and record keymap.json, styles.css, init.js, packages/ and state-cache/; place the theme
#                   packages from G6_PACKAGES that are missing (recorded as added). Exit 1 and nothing changed when
#                   Inkdrop does not quit or the backup cannot be confirmed.
#   start <work>    start Inkdrop with its debugger on 127.0.0.1:9334 (exit 0 only when the PID is alive, its page
#                   is on 9334 and the listener is that PID; otherwise it is quit again: exit 1, or 5 if not)
#   restart <work>  quit the started Inkdrop normally, confirm it is gone and 9334 closed, then start (exit 5 and
#                   no new start when the quit cannot be confirmed)
#   restore <work>  quit the started Inkdrop normally, write config.json back from the backup, take out the added
#                   packages (moved into <work>/private, not deleted), check every recorded file against the
#                   backup, and bring Inkdrop back to how it was: started normally if it ran before, left quit if
#                   not; 9334 closed either way. Exit 0 RESTORED only when every check holds, 5 otherwise (what
#                   is not back is listed). state-cache/, the database and the sync state are NOT restored: their
#                   change is only reported.
# <work> must be outside the repository, iCloud and the Inkdrop profile; raw files go to <work>/private (0700).
# Self-test only: INKDROP_APP, G6_PROD_DIR, G6_PORT, G6_START_TIMEOUT, G6_QUIT_WAIT, G6_TEST_PGREP (command
# listing the Inkdrop main PIDs), G6_TEST_QUIT (command that quits Inkdrop normally), G6_TEST_OPEN (normal start).
set -euo pipefail
cmd="$1"; work="$2"
root="$(cd "$(dirname "$0")/../.." && pwd -P)"
app="${INKDROP_APP:-/Applications/Inkdrop.app}"
prod="${G6_PROD_DIR:-$HOME/Library/Application Support/inkdrop}"
port="${G6_PORT:-9334}"
priv="$work/private"
running() { ${G6_TEST_PGREP:-pgrep -x Inkdrop} 2>/dev/null | sort || true; }
quit_app() { if [ -n "${G6_TEST_QUIT:-}" ]; then sh -c "$G6_TEST_QUIT"; else osascript -e 'tell application "Inkdrop" to quit' > /dev/null 2>&1 || true; fi; }
listener() { lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true; }
port_open() { curl -s --max-time 1 "http://127.0.0.1:$port/json/version" > /dev/null || [ -n "$(listener)" ]; }
sha() { shasum -a 256 "$1" | cut -c1-64; }
# One line per recorded file: name and SHA-256 (or "absent"); packages/ as one line per package over its files.
sums() {
  for f in config.json keymap.json styles.css init.js; do [ -f "$prod/$f" ] && echo "$f $(sha "$prod/$f")" || echo "$f absent"; done
  if [ -d "$prod/packages" ]; then
    for p in "$prod/packages"/*/; do [ -d "$p" ] || continue; echo "packages/$(basename "$p") $(cd "$p" && find . -type f | LC_ALL=C sort | while read -r f; do shasum -a 256 "$f"; done | shasum -a 256 | cut -c1-64)"; done
  fi
}
# Quit Inkdrop the normal way and wait until no Inkdrop main process is left; never a force quit.
quit_wait() {
  quit_app
  for _ in $(seq 1 "${G6_QUIT_WAIT:-60}"); do [ -z "$(running)" ] && return 0; sleep 1; done
  [ -z "$(running)" ]
}

case "$(cd "$work" 2>/dev/null && pwd -P || echo "$work")/" in
  "$root/"*|"$HOME/Library/Mobile Documents/"*|"$(cd "$prod" 2>/dev/null && pwd -P || echo "$prod")/"*) echo "the work dir must be outside the repository, iCloud and the Inkdrop profile" >&2; exit 2 ;;
esac

if [ "$cmd" = prepare ]; then
  [ -e "$priv" ] && { echo "$priv exists: one prepare per work dir" >&2; exit 2; }
  mkdir -p "$priv/backup"; chmod 700 "$priv"
  echo production > "$work/mode.txt"
  if [ -n "$(running)" ]; then echo yes > "$work/was-running.txt"; else echo no > "$work/was-running.txt"; fi
  if [ "$(cat "$work/was-running.txt")" = yes ] && ! quit_wait; then echo "NOT PREPARED: Inkdrop did not quit; nothing was changed"; exit 1; fi
  [ -f "$prod/config.json" ] || { echo "NOT PREPARED: no config.json to back up; nothing was changed"; exit 1; }
  cp -p "$prod/config.json" "$priv/backup/config.json"
  [ "$(sha "$prod/config.json")" = "$(sha "$priv/backup/config.json")" ] || { echo "NOT PREPARED: the config.json backup does not match; nothing was changed"; exit 1; }
  sums > "$priv/backup/sums-before.txt"
  { [ -d "$prod/state-cache" ] && (cd "$prod/state-cache" && find . -type f | LC_ALL=C sort) || true; } > "$priv/backup/state-cache-before.txt"
  : > "$work/added-packages.txt"
  if [ -n "${G6_PACKAGES:-}" ]; then
    for p in "$G6_PACKAGES"/*/; do
      n="$(basename "$p")"
      if [ -e "$prod/packages/$n" ]; then echo "$n: already installed, used as it is (not replaced)"; continue; fi
      mkdir -p "$prod/packages"; cp -R "$p" "$prod/packages/$n"; echo "$n" >> "$work/added-packages.txt"; echo "$n: placed for the run"
    done
  fi
  echo "prepared: Inkdrop was running before: $(cat "$work/was-running.txt"); config.json backed up and checked"
elif [ "$cmd" = start ]; then
  [ -f "$priv/backup/config.json" ] || { echo "not prepared" >&2; exit 2; }
  if port_open || [ -n "$(running)" ]; then echo "NOT STARTED: port $port in use or an Inkdrop already running"; exit 1; fi
  env -u INKDROP_USER_DATA_PATH "$app/Contents/MacOS/Inkdrop" --remote-debugging-port="$port" --remote-debugging-address=127.0.0.1 > "$work/inkdrop.log" 2>&1 &
  pid=$!; echo "$pid" > "$work/inkdrop.pid"
  up=false
  for _ in $(seq 1 "${G6_START_TIMEOUT:-40}"); do
    kill -0 "$pid" 2>/dev/null || break
    if curl -s --max-time 1 "http://127.0.0.1:$port/json/list" | grep -q "file://$app"; then up=true; break; fi
    sleep 1
  done
  if [ "$up" = true ] && [ "$(listener)" = "$pid" ]; then sleep 3; echo "started (pid $pid)"; exit 0; fi
  echo "NOT STARTED: no Inkdrop page on $port, or the listener is not the started pid"
  if quit_wait && ! port_open; then echo "quit again"; exit 1; fi
  echo "CLEANUP FAILED: Inkdrop still running or port $port open"; exit 5
elif [ "$cmd" = restart ]; then
  if ! quit_wait || port_open; then echo "NOT RESTARTED: the quit could not be confirmed (Inkdrop running or port $port open); not started again"; exit 5; fi
  exec bash "$0" start "$work"
elif [ "$cmd" = restore ]; then
  [ -f "$priv/backup/config.json" ] || { echo "not prepared: nothing to restore" >&2; exit 2; }
  left=()
  if ! quit_wait; then echo "RESTORE NOT CONFIRMED: Inkdrop did not quit; config.json not written back"; exit 5; fi
  cp -p "$priv/backup/config.json" "$prod/config.json"
  mkdir -p "$priv/removed"
  while read -r n; do [ -n "$n" ] && [ -e "$prod/packages/$n" ] && mv "$prod/packages/$n" "$priv/removed/$n"; done < "$work/added-packages.txt"
  sums > "$priv/backup/sums-restored.txt"
  cmp -s "$priv/backup/sums-before.txt" "$priv/backup/sums-restored.txt" || left+=("files differ from the backup: $(diff "$priv/backup/sums-before.txt" "$priv/backup/sums-restored.txt" | grep '^[<>]' | cut -c3- | cut -d' ' -f1 | sort -u | paste -sd' ' - || true)")
  if [ "$(cat "$work/was-running.txt")" = yes ]; then
    if [ -n "${G6_TEST_OPEN:-}" ]; then sh -c "$G6_TEST_OPEN"; else open -a "$app"; fi
    for _ in $(seq 1 30); do [ -n "$(running)" ] && break; sleep 1; done
    sleep 5
    [ -n "$(running)" ] || left+=("Inkdrop did not start again")
    [ "$(sha "$prod/config.json")" = "$(sha "$priv/backup/config.json")" ] || left+=("config.json changed after the normal start")
  else
    [ -z "$(running)" ] || left+=("an Inkdrop is running although it was not before")
  fi
  port_open && left+=("port $port is open")
  { [ -d "$prod/state-cache" ] && (cd "$prod/state-cache" && find . -type f | LC_ALL=C sort) || true; } > "$priv/backup/state-cache-after.txt"
  echo "not restored by design: state-cache files before $(wc -l < "$priv/backup/state-cache-before.txt" | tr -d ' '), after $(wc -l < "$priv/backup/state-cache-after.txt" | tr -d ' '); the database and the sync state are not compared"
  if [ ${#left[@]} -eq 0 ]; then echo "RESTORED: config.json, keymap.json, styles.css, init.js and packages/ as before; Inkdrop $([ "$(cat "$work/was-running.txt")" = yes ] && echo 'started normally' || echo 'left quit') as before; port $port closed"; exit 0; fi
  printf 'RESTORE NOT CONFIRMED: %s\n' "$(printf '%s; ' "${left[@]}")"; exit 5
else
  echo "usage: $0 prepare|start|restart|restore <work_dir>" >&2; exit 2
fi
