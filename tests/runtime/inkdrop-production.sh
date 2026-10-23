#!/usr/bin/env bash
# Step 11G G6 method C (research/14 §6.103, §6.105): run the user's own Inkdrop for V-35 and put it back.
# Only with the user's explicit approval of method C and their go right before. Never signs in or out, never
# reads the keychain, never writes a note, never force-quits (a force quit can damage the database).
#
#   prepare <work>  record whether Inkdrop runs; quit it normally if it does; back up config.json (after the
#                   quit) into a temporary file, confirm its SHA-256 against the original and only then make it the
#                   backup (config.json + config.sha256); record keymap.json, styles.css, init.js, packages/ and
#                   state-cache/; place the theme packages from G6_PACKAGES that are missing (recorded as added).
#                   Exit 1 when Inkdrop does not quit (nothing changed) or the backup cannot be confirmed (then the
#                   report says Inkdrop was quit, config.json is untouched, and a quit Inkdrop is started again).
#   start <work>    start Inkdrop with its debugger on 127.0.0.1:9334 (exit 0 only when the PID is alive, its page
#                   is on 9334 and the listener is that PID; otherwise it is quit again: exit 1, or 5 if not)
#   restart <work>  quit the started Inkdrop normally, confirm it is gone (stopped below) and 9334 closed, then start
#                   (exit 5 and no new start when that cannot be confirmed)
#   restore <work>  only with a confirmed backup of this work dir whose SHA-256 still matches the recorded one
#                   (otherwise exit 5 and no file touched); quit the started Inkdrop normally and confirm it is stopped (no Inkdrop main process, no
#                   process of the app bundle such as its helpers, nothing on 9334); only then write config.json
#                   back (exit 5 RESTORE NOT CONFIRMED and no file touched otherwise); take out the added
#                   packages (moved into <work>/private, not deleted), check every recorded file against the
#                   backup, and bring Inkdrop back to how it was: started normally if it ran before, left quit if
#                   not; 9334 closed either way. Exit 0 RESTORED only when every check holds, 5 otherwise (what
#                   is not back is listed). state-cache/, the database and the sync state are NOT restored: their
#                   change is only reported.
# <work> must be outside the repository, iCloud and the Inkdrop profile; raw files go to <work>/private (0700).
# Self-test only: G6_TEST_CORRUPT_BACKUP=1 alters the temporary backup copy before its check; INKDROP_APP, G6_PROD_DIR, G6_PORT, G6_START_TIMEOUT, G6_QUIT_WAIT, G6_TEST_PGREP (command
# listing the Inkdrop main PIDs), G6_TEST_HELPERS (command listing the app bundle's processes), G6_TEST_QUIT
# (command that quits Inkdrop normally), G6_TEST_OPEN (normal start).
set -euo pipefail
cmd="$1"; work="$2"
root="$(cd "$(dirname "$0")/../.." && pwd -P)"
app="${INKDROP_APP:-/Applications/Inkdrop.app}"
prod="${G6_PROD_DIR:-$HOME/Library/Application Support/inkdrop}"
port="${G6_PORT:-9334}"
priv="$work/private"
running() { ${G6_TEST_PGREP:-pgrep -x Inkdrop} 2>/dev/null | sort || true; }
helpers() { ${G6_TEST_HELPERS:-pgrep -f "$app/Contents/"} 2>/dev/null | sort || true; }
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
# Quit Inkdrop the normal way and wait until no Inkdrop main process is left; never a force quit. Nothing is
# sent when no Inkdrop runs.
quit_wait() {
  [ -z "$(running)" ] && return 0
  quit_app
  for _ in $(seq 1 "${G6_QUIT_WAIT:-60}"); do [ -z "$(running)" ] && return 0; sleep 1; done
  [ -z "$(running)" ]
}

# What still runs of Inkdrop (empty: stopped): a main process, a process of the app bundle (helpers), the port.
not_stopped() {
  [ -n "$(running)" ] && echo "an Inkdrop main process is running"
  [ -n "$(helpers)" ] && echo "processes of the Inkdrop app are still running"
  port_open && echo "port $port is open"
  return 0
}
# The backup of this work dir is confirmed: config.sha256 written after the check, and the backup still matching it.
confirmed() {
  [ -f "$priv/backup/config.sha256" ] && [ -f "$priv/backup/config.json" ] && [ "$(sha "$priv/backup/config.json")" = "$(cat "$priv/backup/config.sha256")" ]
}
# A prepare that quit Inkdrop and then failed before the backup was confirmed: config.json was not touched; a
# quit Inkdrop is started again normally, and the report says what was done.
fail_unconfirmed() {
  echo "NOT PREPARED: $1; no backup confirmed; config.json untouched"
  if [ "$(cat "$work/was-running.txt")" = yes ]; then
    if [ -n "${G6_TEST_OPEN:-}" ]; then sh -c "$G6_TEST_OPEN"; else open -a "$app"; fi
    for _ in $(seq 1 30); do [ -n "$(running)" ] && break; sleep 1; done
    if [ -n "$(running)" ]; then echo "Inkdrop was running before, was quit for the run, and is started again normally"
    else echo "Inkdrop was running before and was quit for the run; starting it again could not be confirmed: it is NOT running now"; fi
  else
    echo "Inkdrop was not running before and is not running now"
  fi
  exit 1
}
# State of the profile after a prepare that did not finish, for the report.
prepare_state() {
  echo "Inkdrop was running before: $(cat "$work/was-running.txt"); running now: $([ -n "$(running)" ] && echo yes || echo no); placed packages: $(paste -sd' ' - < "$work/added-packages.txt" 2>/dev/null)$([ -s "$work/added-packages.txt" ] || echo none)"
}

case "$(cd "$work" 2>/dev/null && pwd -P || echo "$work")/" in
  "$root/"*|"$HOME/Library/Mobile Documents/"*|"$(cd "$prod" 2>/dev/null && pwd -P || echo "$prod")/"*) echo "the work dir must be outside the repository, iCloud and the Inkdrop profile" >&2; exit 2 ;;
esac

if [ "$cmd" = prepare ]; then
  [ -e "$priv" ] && { echo "$priv exists: one prepare per work dir" >&2; exit 2; }
  mkdir -p "$priv/backup"; chmod 700 "$priv"
  echo production > "$work/mode.txt"
  if [ -n "$(running)" ]; then echo yes > "$work/was-running.txt"; else echo no > "$work/was-running.txt"; fi
  if ! quit_wait; then echo "NOT PREPARED: Inkdrop did not quit; nothing was changed; it is still running"; exit 1; fi
  [ -f "$prod/config.json" ] || fail_unconfirmed "no config.json to back up"
  tmpb="$priv/backup/config.json.partial"
  cp -p "$prod/config.json" "$tmpb" 2>/dev/null || fail_unconfirmed "the backup copy failed"
  [ -n "${G6_TEST_CORRUPT_BACKUP:-}" ] && echo corrupt >> "$tmpb"
  if [ "$(sha "$prod/config.json")" != "$(sha "$tmpb")" ]; then rm "$tmpb"; fail_unconfirmed "the backup copy does not match config.json"; fi
  mv "$tmpb" "$priv/backup/config.json"
  sha "$priv/backup/config.json" > "$priv/backup/config.sha256"
  confirmed || fail_unconfirmed "the backup could not be confirmed"
  sums > "$priv/backup/sums-before.txt"
  { [ -d "$prod/state-cache" ] && (cd "$prod/state-cache" && find . -type f | LC_ALL=C sort) || true; } > "$priv/backup/state-cache-before.txt"
  : > "$work/added-packages.txt"
  if [ -n "${G6_PACKAGES:-}" ]; then
    mkdir -p "$prod/packages"
    for p in "$G6_PACKAGES"/*/; do
      n="$(basename "$p")"
      if [ -e "$prod/packages/$n" ]; then echo "$n: already installed, used as it is (not replaced)"; continue; fi
      # Copied completely into a hidden partial directory next to it first, then renamed into place in one step,
      # so a failed copy never leaves a partial package; the partial directory is removed on failure.
      part="$prod/packages/.g6-$n.partial"
      [ -e "$part" ] && { echo "NOT PREPARED: $part already exists (not ours, left alone); config.json untouched; $(prepare_state)"; exit 1; }
      if ! cp -R "$p" "$part" 2>/dev/null || ! mv "$part" "$prod/packages/$n"; then
        [ -e "$part" ] && rm -R "$part"
        echo "NOT PREPARED: placing $n failed; $([ -e "$part" ] && echo "a partial copy is left at .g6-$n.partial" || echo "no partial package left"); config.json untouched; $(prepare_state)"; exit 1
      fi
      echo "$n" >> "$work/added-packages.txt"; echo "$n: placed for the run"
    done
  fi
  echo "prepared: Inkdrop was running before: $(cat "$work/was-running.txt"); config.json backed up and checked"
elif [ "$cmd" = start ]; then
  confirmed || { echo "not prepared: no confirmed backup" >&2; exit 2; }
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
  quit_wait || true
  left="$(not_stopped)"
  if [ -z "$left" ]; then echo "quit again"; exit 1; fi
  echo "CLEANUP FAILED: $(echo "$left" | paste -sd';' -)"; exit 5
elif [ "$cmd" = restart ]; then
  quit_wait || true
  left="$(not_stopped)"
  if [ -n "$left" ]; then echo "NOT RESTARTED: not stopped ($(echo "$left" | paste -sd';' -)); not started again"; exit 5; fi
  exec bash "$0" start "$work"
elif [ "$cmd" = restore ]; then
  confirmed || { echo "RESTORE NOT CONFIRMED: no confirmed backup of this work dir, or it no longer matches its SHA-256; no file was touched"; exit 5; }
  left=()
  quit_wait || true
  stopped="$(not_stopped)"
  if [ -n "$stopped" ]; then echo "RESTORE NOT CONFIRMED: Inkdrop is not stopped ($(echo "$stopped" | paste -sd';' -)); no file was touched"; exit 5; fi
  # Checked again right before the write: a backup that changed since its confirmation is never written.
  confirmed || { echo "RESTORE NOT CONFIRMED: the backup no longer matches its SHA-256; no file was touched"; exit 5; }
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
