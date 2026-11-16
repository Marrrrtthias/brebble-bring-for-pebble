#!/usr/bin/env bash
# Takes the Rebble store screenshots for every platform in the Pebble emulator.
#
# The app is built from a temporary copy of the repo in which the Bring! API
# client is replaced by an offline mock with a demo list (mock-bring-api.js),
# so no account is needed and the repository itself is never modified.
#
# Requirements: pebble-tool with the SDK from the CI workflow installed
#   (pebble sdk install 4.44).
#
# Usage: store/screenshots/take_screenshots.sh [platform ...]
# Output: store/screenshots/<watch>_1.png (top of the list)
#         store/screenshots/<watch>_2.png (scrolled down)
# where <watch> is the product name, e.g. emery -> pebble-time-2.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PLATFORMS=("$@")
if [ ${#PLATFORMS[@]} -eq 0 ]; then
  PLATFORMS=(aplite basalt chalk diorite emery flint gabbro)
fi

# Emulator platform -> watch name used in the file names.
watch_name() {
  case "$1" in
    aplite)  echo pebble-classic ;;
    basalt)  echo pebble-time ;;
    chalk)   echo pebble-time-round ;;
    diorite) echo pebble-2 ;;
    emery)   echo pebble-time-2 ;;
    flint)   echo pebble-2-duo ;;
    gabbro)  echo pebble-round-2 ;;
    *)       echo "$1" ;;
  esac
}

WORK="$(mktemp -d)"
trap 'pebble kill >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

# Build a copy with the mock API client.
mkdir "$WORK/app"
(cd "$REPO" && tar --exclude=./.git --exclude=./build --exclude=./node_modules --exclude=./store -cf - .) | tar -xf - -C "$WORK/app"
cp "$HERE/mock-bring-api.js" "$WORK/app/src/pkjs/bring-api.js"
(cd "$WORK/app" && pebble build)
PBW="$(ls "$WORK"/app/build/*.pbw)"

for platform in "${PLATFORMS[@]}"; do
  echo "== $platform"
  pebble kill >/dev/null 2>&1 || true
  (cd "$WORK/app" && pebble install --emulator "$platform" "$PBW")
  # Give the app time to launch and sync with the mock phone (aplite is slow).
  sleep 15
  shot() { (cd "$WORK/app" && pebble screenshot --emulator "$platform" --no-open "$HERE/$(watch_name "$platform")_$1.png"); }
  shot 1
  (cd "$WORK/app" && pebble emu-button --emulator "$platform" click down --repeat 4 --interval 300)
  sleep 2
  shot 2
done
echo "Screenshots written to $HERE"
