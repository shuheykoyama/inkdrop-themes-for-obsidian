#!/usr/bin/env bash
# A second, isolated Obsidian for the runtime tests that uses the CURRENT installer (its own Electron),
# next to the existing one (/Applications/Obsidian.app, installer 1.11.7 + app 1.14.4 asar). research/14 §6.3.
# Nothing here touches /Applications/Obsidian.app, the user's vaults or settings.
#
# usage: bash tests/runtime/current-installer.sh prepare   download, verify, copy (does NOT launch)
#        bash tests/runtime/current-installer.sh check     print the obsidian:// handler and LaunchServices records
#        bash tests/runtime/current-installer.sh restore   remove the copy's LaunchServices registration
#
# Then run the isolated instance on it:
#   OBSIDIAN_APP="$HOME/.cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app" OBSIDIAN_ASAR=none \
#     bash tests/runtime/obsidian-isolated.sh start <work>
#
# OBSIDIAN_VERSION=1.14.5 does the same for that release (research/14 §6.123), and also fetches its app asar
# (obsidian-<version>.asar, for the Electron 39.5.1 run on /Applications/Obsidian.app); check and restore then act
# on that version's copy. The digests are the GitHub release asset digests.
#
# LaunchServices: copying (not only launching) the bundle registered it as a second candidate for
# obsidian:// URLs on 2026-10-11; the default handler stayed /Applications/Obsidian.app. `restore`
# unregisters the copy; run `check` before and after every use and compare.
set -euo pipefail
VERSION="${OBSIDIAN_VERSION:-1.14.4}"
case "$VERSION" in
  1.14.4) SHA256=dcf818dd20ee5d9dd3e782eee0c0c4c47cc225383b051c2fc9af7d5772f59f70; ASAR_SHA256= ;;
  1.14.5) SHA256=be79e6410d80fa705218aa4e8cb24ce8418cf16e13be4036227a5659b1f6aab2; ASAR_SHA256=20544378d99335bd54f4f03d9bb4b8ba8e4dc68ac4b5072eed81cde53d33503b ;;
  *) echo "no recorded digest for Obsidian $VERSION" >&2; exit 2 ;;
esac
DMG="Obsidian-$VERSION.dmg"
URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v$VERSION/$DMG"
TEAM=6JSW4SJWN9                                                             # Dynalist Inc. (as /Applications/Obsidian.app)
DIR="$HOME/.cache/inkdrop-themes-for-obsidian/obsidian-$VERSION"
APP="$DIR/Obsidian.app"
LSR=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
here="$(cd "$(dirname "$0")" && pwd)"

case "${1:-}" in
  prepare)
    mkdir -p "$DIR"
    [ -f "$DIR/$DMG" ] || curl -fL --proto '=https' --tlsv1.2 -o "$DIR/$DMG" "$URL"
    echo "$SHA256  $DIR/$DMG" | shasum -a 256 -c -
    mnt="$DIR/mnt"; mkdir -p "$mnt"
    hdiutil attach -nobrowse -readonly -noautoopen -mountpoint "$mnt" "$DIR/$DMG" > /dev/null
    trap 'hdiutil detach "$mnt" > /dev/null 2>&1 || true; rmdir "$mnt" 2>/dev/null || true; "$LSR" -u "$mnt/Obsidian.app" 2>/dev/null || true' EXIT
    codesign --verify --deep --strict "$mnt/Obsidian.app"
    codesign -dv "$mnt/Obsidian.app" 2>&1 | grep -q "TeamIdentifier=$TEAM"
    spctl -a -t exec "$mnt/Obsidian.app"                                  # Gatekeeper assessment only, no launch
    rm -rf "$APP" && ditto "$mnt/Obsidian.app" "$APP"
    codesign --verify --deep --strict "$APP"
    if [ -n "$ASAR_SHA256" ]; then
      [ -f "$DIR/obsidian-$VERSION.asar.gz" ] || curl -fL --proto '=https' --tlsv1.2 -o "$DIR/obsidian-$VERSION.asar.gz" "https://github.com/obsidianmd/obsidian-releases/releases/download/v$VERSION/obsidian-$VERSION.asar.gz"
      echo "$ASAR_SHA256  $DIR/obsidian-$VERSION.asar.gz" | shasum -a 256 -c -
      gunzip -c "$DIR/obsidian-$VERSION.asar.gz" > "$DIR/obsidian-$VERSION.asar"
    fi
    "$LSR" -u "$APP" || true                                              # copying registers the bundle; undo it
    echo "app $(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)," \
      "electron $(defaults read "$APP/Contents/Frameworks/Electron Framework.framework/Resources/Info.plist" CFBundleVersion)"
    ;;
  check)
    swift "$here/lib/url-handler.swift"
    "$LSR" -dump 2>/dev/null | grep -E '^path: .*Obsidian\.app \(' | grep -v '/Contents/' || true
    ;;
  restore)
    "$LSR" -u "$APP" || true
    swift "$here/lib/url-handler.swift"
    ;;
  *)
    echo "usage: $0 prepare|check|restore" >&2; exit 2 ;;
esac
