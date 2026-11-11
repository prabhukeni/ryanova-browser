#!/usr/bin/env bash
set -euo pipefail
pid="$1"; current="$2"; staged="$3"
[[ "$pid" =~ ^[0-9]+$ ]] || exit 1
[[ -f "$current" && -f "$staged" ]] || exit 1
for _ in $(seq 1 120); do
  kill -0 "$pid" 2>/dev/null || break
  sleep 1
done
kill -0 "$pid" 2>/dev/null && exit 1
backup="${current}.previous"
[[ ! -e "$backup" ]] || rm -f -- "$backup"
mv -- "$current" "$backup"
if ! mv -- "$staged" "$current"; then
  mv -- "$backup" "$current"
  exit 1
fi
chmod u+x -- "$current"
nohup "$current" >/dev/null 2>&1 </dev/null &
