#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo 'Install Node.js 20+ first'; exit 1; }
command -v npm >/dev/null || { echo 'npm required'; exit 1; }
echo 'Installing build dependencies (internet required)...'
npm install --no-audit --no-fund
npm run dist:linux
printf '
Packages are in dist/
'
