#!/usr/bin/env bash
# Fetch every input source of the Phase 1 research at the pinned commits / versions.
#
# usage: research/tools/fetch_sources.sh <work_dir>
#
# Layout produced (the analysis scripts expect exactly this):
#   <work_dir>/repo-shas.txt               "<dir> <sha> <date> <url>" per repository
#   <work_dir>/repos/<owner>_<name>/       each repository checked out at its pinned SHA
#   <work_dir>/obsidian-app/asar-<ver>/    extracted Obsidian app bundle (app.css, app.js, ...)
#
# Requirements: git, curl, gunzip, shasum, node/npx (for @electron/asar). Nothing is installed globally.
set -euo pipefail

work="${1:?usage: fetch_sources.sh <work_dir>}"
here="$(cd "$(dirname "$0")" && pwd)"
lock="$here/sources.lock"

mkdir -p "$work/repos" "$work/obsidian-app"
: > "$work/repo-shas.txt"

# Each lock line: <dir> <sha> <clone url>
while read -r dir sha url; do
  [ -z "$dir" ] && continue
  dest="$work/repos/$dir"
  if [ ! -d "$dest/.git" ]; then
    git init -q "$dest"
    git -C "$dest" remote add origin "$url"
  fi
  # Fetch only the pinned commit (GitHub allows fetching a reachable SHA directly).
  git -C "$dest" fetch -q --depth 1 origin "$sha"
  git -C "$dest" checkout -q --detach "$sha"
  date="$(git -C "$dest" log -1 --format=%cI)"
  echo "$dir $sha $date $url" >> "$work/repo-shas.txt"
  echo "fetched $dir @ ${sha:0:7}"
done < "$lock"

# Obsidian app bundles: 1.14.4 = latest stable at research time, 1.13.7 = user environment.
for ver in 1.14.4 1.13.7; do
  out="$work/obsidian-app/asar-$ver"
  [ -f "$out/app.css" ] && continue
  gz="$work/obsidian-app/obsidian-$ver.asar.gz"
  curl -fsSL -o "$gz" "https://github.com/obsidianmd/obsidian-releases/releases/download/v$ver/obsidian-$ver.asar.gz"
  gunzip -f "$gz"
  # Pinned to the version used for the Phase 1B verification.
  npx -y @electron/asar@4.3.1 extract "$work/obsidian-app/obsidian-$ver.asar" "$out"
  echo "extracted Obsidian $ver"
done

# Expected app.css SHA-256 values recorded in research/00-sources.md.
shasum -a 256 "$work"/obsidian-app/asar-*/app.css
