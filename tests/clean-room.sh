#!/usr/bin/env bash
# S2: clean-environment reproducibility (reused from research/poc/q-d21-build/tests/clean-room.sh).
# Copies the tracked inputs (no node_modules, no dist) to a new temporary directory, installs the
# locked dependencies with `npm ci`, builds, runs the static tests there, and compares the outputs
# with a build of the working copy byte for byte.
#
# usage: bash tests/clean-room.sh        (needs network access for npm ci)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cd "$root"
mkdir -p "$work/research"
cp -R research/data "$work/research/data"
mkdir -p "$work/research/evidence/phase2-p0/measurements"
cp research/evidence/phase2-p0/measurements/inkdrop-sd-1-default.json research/evidence/phase2-p0/measurements/inkdrop-kd-1-default.json "$work/research/evidence/phase2-p0/measurements/"
tar -cf - package.json package-lock.json .stylelintrc.json scripts src tests | (cd "$work" && tar -xf -)

cd "$work"
npm ci --no-audit --no-fund --ignore-scripts
npm run build --silent
node tests/static/run.mjs > static.log || { cat static.log; exit 1; }
echo "clean-room static tests: $(grep -c '^PASS' static.log) PASS, $(grep -c '^FAIL' static.log || true) FAIL"

(cd "$root" && npm run build --silent > /dev/null)
status=0
for f in dist/*/theme.css dist/*/manifest.json; do
  if cmp -s "$f" "$root/$f"; then echo "PASS clean-room $f identical to local build"; else echo "FAIL clean-room $f differs"; status=1; fi
done
exit $status
