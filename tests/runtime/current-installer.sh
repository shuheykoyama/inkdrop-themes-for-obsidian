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
# LaunchServices: copying (not only launching) the bundle registered it as a second candidate for
# obsidian:// URLs on 2026-10-11; the default handler stayed /Applications/Obsidian.app. `restore`
# unregisters the copy; run `check` before and after every use and compare.
set -euo pipefail
VERSION=1.14.4
DMG="Obsidian-$VERSION.dmg"
URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v$VERSION/$DMG"
SHA256=dcf818dd20ee5d9dd3e782eee0c0c4c47cc225383b051c2fc9af7d5772f59f70   # GitHub release asset digest
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
