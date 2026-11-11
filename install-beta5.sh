#!/usr/bin/env bash
set -euo pipefail
BASE="/mnt/c/Users/supri/Downloads/Rynova-Browser-1.1.0-beta-source"
TARGET="$BASE/Ryanova-Browser-1.1.0-beta.5"
ARCHIVE="${1:-/mnt/c/Users/supri/Downloads/Ryanova-beta5-reviewed-source.tar.gz}"
[[ -f "$ARCHIVE" ]] || { echo "Missing archive: $ARCHIVE"; exit 1; }
[[ ! -e "$TARGET" ]] || { echo "Target already exists; refusing overwrite: $TARGET"; exit 1; }
mkdir -p "$TARGET"
trap 'echo "Installation failed; inspect: $TARGET"' ERR
tar -xzf "$ARCHIVE" -C "$TARGET"
cd "$TARGET"
[[ "$(node -p "require('./package.json').version")" == "1.1.0-beta.5" ]]
for f in main.js preload.js privacy.js ui/app.js ui/overlay.js; do node --check "$f"; done
node --test tests/privacy.test.js
npm ci
npm run dist:linux
printf '\nBETA.5 BUILD COMPLETE: %s\n' "$TARGET"
ls -lh dist/*.deb dist/*.AppImage
printf '\nRead BETA5-REVIEW.md before publishing.\n'
