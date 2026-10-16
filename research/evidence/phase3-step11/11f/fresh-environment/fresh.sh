#!/usr/bin/env bash
# Fresh-environment check of tests/README.md: a new clone, the documented commands only.
set -u
S="$1"; F="$S/11f/fresh"; export TMPDIR="$F/tmp/"; mkdir -p "$TMPDIR"
log() { echo "== $(date -u +%FT%TZ) $*"; }
cd "$F" && git clone -q "$2" repo && cd repo && git log --oneline -1
log "node $(node -v), npm $(npm -v)"
log "npm ci"; npm ci --no-audit --no-fund 2>&1 | tail -2
log "npm run build"; npm run -s build 2>&1 | tail -2
log "npm test"; npm test 2>&1 | grep -E "^all |FAILED|passed" ; echo "npm test exit ${PIPESTATUS[0]}"
log "section 2, E39, OBSIDIAN_FRAME=custom"
W="$(mktemp -d)"; V="$(OBSIDIAN_FRAME=custom bash tests/runtime/obsidian-isolated.sh start "$W" | tail -1)"; echo "vault: ${V#$F/}"
log "section 3, custom-frame run"; node tests/runtime/run.mjs --vault "$V" --out "$F/frame.json" 2>&1 | tail -3
bash tests/runtime/obsidian-isolated.sh stop "$W"
log "section 2, E43"
bash tests/runtime/current-installer.sh check > "$F/ls-before.txt" 2>&1
W="$(mktemp -d)"; V="$(OBSIDIAN_APP="$HOME/.cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app" OBSIDIAN_ASAR=none bash tests/runtime/obsidian-isolated.sh start "$W" | tail -1)"; echo "vault: ${V#$F/}"
log "section 5, mermaid-pixels on E43"; node tests/visual/mermaid-pixels.mjs --vault "$V" --out "$F/pixels.json" 2>&1 | tail -1
bash tests/runtime/obsidian-isolated.sh stop "$W"
log "section 8"; bash tests/runtime/current-installer.sh restore > /dev/null 2>&1; bash tests/runtime/current-installer.sh check > "$F/ls-after.txt" 2>&1
diff -q "$F/ls-before.txt" "$F/ls-after.txt" > /dev/null && echo "LaunchServices check: identical before and after" || echo "LaunchServices check: DIFFERENT"
log "section 6, kit"; node tests/device/build-kit.mjs "$F/kit" 2>&1 | tail -2
node tests/device/kit-self-test.mjs build "$F/kit-build" 2>&1 | tail -1
log "left instances"; pgrep -fl user-data-dir | grep -c "$F" || true
log end
