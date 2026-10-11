#!/usr/bin/env bash
# T2: clean-environment reproducibility. Copies the PoC sources (no node_modules, no dist) to a new
# temporary directory, installs the locked dependencies with `npm ci`, builds all three methods,
# runs the static tests there, and compares the outputs with a local build byte for byte.
#
# usage: tests/clean-room.sh        (from research/poc/q-d21-build; needs network access for npm ci)
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The static tests read research/data, so keep the same relative layout: <work>/research/{data,poc/q-d21-build}.
mkdir -p "$work/research/poc/q-d21-build"
cp -R "$root/../../data" "$work/research/data"
( cd "$root" && tar --exclude=node_modules --exclude=dist -cf - . ) | ( cd "$work/research/poc/q-d21-build" && tar -xf - )

cd "$work/research/poc/q-d21-build"
npm ci --no-audit --no-fund --ignore-scripts
npm run build --silent
node tests/test-static.mjs > static.log || { cat static.log; exit 1; }
echo "clean-room static tests: $(grep -c '^PASS' static.log) PASS, $(grep -c '^FAIL' static.log || true) FAIL"

# Same outputs as a build in the working copy?
( cd "$root" && npm run build --silent > /dev/null )
status=0
for f in dist/p1/*.css dist/p2/*.css dist/p3/*.css; do
  if cmp -s "$f" "$root/$f"; then echo "PASS clean-room $f identical to local build"; else echo "FAIL clean-room $f differs"; status=1; fi
done
exit $status
